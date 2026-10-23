import type { Database } from "firebase-admin/database";
import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { compareAndSet, rateLimit } from "./helpers";
import { requireMediaAdmin } from "./media/auth";
import type { MediaBatchAsset, MediaUploadBatch } from "./media/batch";
import {
  MAX_IMAGE_BYTES,
  MAX_TRACKS_PER_ALBUM,
  MAX_TRACK_BYTES,
  MAX_VIDEO_BYTES,
  MAX_ZIP_BYTES,
  MEDIA_AWS_ACCESS_KEY_ID,
  MEDIA_AWS_REGION,
  MEDIA_AWS_SECRET_ACCESS_KEY,
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  MEDIA_S3_BUCKET,
  MULTIPART_PART_BYTES,
  isMediaEmulator,
  mediaBaseUrl,
} from "./media/config";
import { mediaUrl } from "./media/naming";
import {
  normalizeMetadata,
  normalizeTrackTitles,
} from "./media/metadata";
import {
  getStorageAdapter,
  type StorageAdapter,
} from "./media/storage-adapter";

const MEDIA_SECRETS = isMediaEmulator()
  ? []
  : [
    MEDIA_AWS_REGION,
    MEDIA_AWS_ACCESS_KEY_ID,
    MEDIA_AWS_SECRET_ACCESS_KEY,
    MEDIA_S3_BUCKET,
    MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  ];

const REPLACE_REJECTED = "This record cannot be replaced.";

interface MediaStorageRecord {
  managed?: boolean;
  key?: string;
  iconKey?: string;
  batchId?: string;
}

interface MediaRecord {
  type?: string;
  storage?: MediaStorageRecord;
}

interface ClientPart {
  partNumber: number;
  etag: string;
}

function failed(message: string): HttpsError {
  return new HttpsError("failed-precondition", message);
}

function uploadInvalid(key: string): HttpsError {
  return failed(
    `Upload not found or invalid for "${key}". Upload the file again.`
  );
}

function capFor(role: MediaBatchAsset["role"]): number {
  switch (role) {
    case "video":
      return MAX_VIDEO_BYTES;
    case "track":
      return MAX_TRACK_BYTES;
    case "cover":
    case "thumbnail":
      return MAX_IMAGE_BYTES;
    case "zip":
      return MAX_ZIP_BYTES;
  }
}

function normalizeEtag(value: string): string {
  return value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
}

function isPreconditionFailed(err: unknown): boolean {
  const error = err as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    error?.name === "PreconditionFailed" ||
    error?.$metadata?.httpStatusCode === 412
  );
}

async function releaseFinalizeClaim(
  db: Database,
  batchId: string
): Promise<void> {
  try {
    await db.ref(`mediaUploads/${batchId}`).update({
      status: "ticketed",
      lastActivityAt: Date.now(),
    });
  } catch (err) {
    console.error("Could not release the finalize claim", err);
  }
}

async function assertNoCreateDuplicate(
  db: Database,
  field: "fileName" | "folderName",
  value: string,
  display: string,
  batchId: string
): Promise<void> {
  const snapshot = await db
    .ref("media")
    .orderByChild(field)
    .equalTo(value)
    .get();
  const records = (snapshot.val() ?? {}) as Record<string, MediaRecord>;
  for (const record of Object.values(records)) {
    if (record?.storage?.batchId !== batchId) {
      throw new HttpsError(
        "already-exists",
        `A record named "${display}" already exists. Delete it or choose a different name.`
      );
    }
  }
}

function clientPartsFor(
  value: unknown,
  role: MediaBatchAsset["role"],
  trackIndex: number | undefined
): ClientPart[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parts: ClientPart[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const part = raw as Record<string, unknown>;
    if (
      part.role !== role ||
      (role === "track" && part.trackIndex !== trackIndex) ||
      typeof part.partNumber !== "number" ||
      !Number.isInteger(part.partNumber) ||
      typeof part.etag !== "string"
    ) {
      continue;
    }
    parts.push({ partNumber: part.partNumber, etag: part.etag });
  }
  return parts;
}

async function verifyObject(
  adapter: StorageAdapter,
  asset: MediaBatchAsset,
  batchId: string
): Promise<void> {
  const head = await adapter.head(asset.key);
  const batchMatches = head.metadata?.["upload-batch"] === batchId;
  const oversized =
    head.exists &&
    head.size !== undefined &&
    (head.size > asset.size || head.size > capFor(asset.role));
  if (head.exists && (!batchMatches || oversized)) {
    try {
      await adapter.deleteMany([asset.key]);
    } catch (err) {
      console.error("Could not delete invalid media object", err);
    }
  }
  if (
    !head.exists ||
    head.size === undefined ||
    head.size !== asset.size ||
    head.contentType !== asset.contentType ||
    !batchMatches
  ) {
    throw uploadInvalid(asset.key);
  }
}

async function verifyMultipart(
  adapter: StorageAdapter,
  asset: MediaBatchAsset,
  clientParts: ClientPart[],
  mode: "create" | "replace"
): Promise<void> {
  if (!asset.uploadId) {
    throw uploadInvalid(asset.key);
  }
  const partCount = Math.ceil(asset.size / MULTIPART_PART_BYTES);
  const byNumber = new Map<number, string>();
  for (const part of clientParts) {
    if (
      part.partNumber < 1 ||
      part.partNumber > partCount ||
      byNumber.has(part.partNumber)
    ) {
      throw uploadInvalid(asset.key);
    }
    byNumber.set(part.partNumber, part.etag);
  }
  if (byNumber.size !== partCount) {
    throw uploadInvalid(asset.key);
  }
  const listed = await adapter.listParts(asset.key, asset.uploadId);
  const listedByNumber = new Map(
    listed.map((part) => [part.partNumber, part])
  );
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const expectedSize =
      partNumber < partCount
        ? MULTIPART_PART_BYTES
        : asset.size - (partCount - 1) * MULTIPART_PART_BYTES;
    const clientEtag = byNumber.get(partNumber);
    const actual = listedByNumber.get(partNumber);
    if (
      !clientEtag ||
      !actual ||
      actual.size !== expectedSize ||
      normalizeEtag(actual.etag) !== normalizeEtag(clientEtag)
    ) {
      throw uploadInvalid(asset.key);
    }
  }

  let condition: { ifMatch?: string; ifNoneMatch?: boolean };
  if (mode === "replace") {
    const live = await adapter.head(asset.key);
    if (!live.exists || !live.etag) {
      throw uploadInvalid(asset.key);
    }
    condition = { ifMatch: live.etag };
  } else {
    condition = { ifNoneMatch: true };
  }

  try {
    await adapter.completeMultipart({
      key: asset.key,
      uploadId: asset.uploadId,
      parts: [...byNumber.entries()]
        .sort(([a], [b]) => a - b)
        .map(([partNumber, etag]) => ({ partNumber, etag })),
      ...condition,
    });
  } catch (err) {
    if (isPreconditionFailed(err)) {
      throw failed(
        `Could not complete the upload for "${asset.key}" because the file changed. Upload the file again.`
      );
    }
    throw err;
  }
}

export const finalizeMediaUpload = onCall(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 300,
    secrets: MEDIA_SECRETS,
  },
  async (request) => {
    const uid = await requireMediaAdmin(request);
    if (!(await rateLimit("media-finalize", uid, 60, 3600000))) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many uploads. Try again later."
      );
    }

    const data = (request.data ?? {}) as Record<string, unknown>;
    const batchId = typeof data.batchId === "string" ? data.batchId : "";
    if (!batchId) {
      throw new HttpsError("invalid-argument", "A batch id is required.");
    }

    const db = getDatabase();
    const batchRef = db.ref(`mediaUploads/${batchId}`);
    const initial = ((await batchRef.get()).val() ?? null) as
      | MediaUploadBatch
      | null;
    if (!initial) {
      throw failed("Upload batch not found.");
    }
    if (initial.uid !== uid) {
      throw failed("Upload batch is not available.");
    }
    if (initial.status === "finalized" && initial.resultId) {
      const record = (await db.ref(`media/${initial.resultId}`).get()).val();
      return { id: initial.resultId, record };
    }
    if (initial.status === "finalizing") {
      throw failed("Finalize already in progress.");
    }

    const claimed = await compareAndSet<MediaUploadBatch>(batchRef, (current) => {
      if (!current) {
        return undefined;
      }
      if (current.status === "ticketed") {
        return {
          ...current,
          status: "finalizing",
          lastActivityAt: Date.now(),
        };
      }
      if (current.status === "finalized" && !current.resultId) {
        return {
          ...current,
          status: "finalizing",
          lastActivityAt: Date.now(),
        };
      }
      return undefined;
    });
    if (!claimed.committed || !claimed.value) {
      throw failed("Finalize already in progress.");
    }
    const batch = claimed.value;
    try {
      const trackAssets = batch.assets.filter((asset) => asset.role === "track");
      const videoAsset = batch.assets.find((asset) => asset.role === "video");
      const thumbnailAsset = batch.assets.find(
        (asset) => asset.role === "thumbnail"
      );
      const coverAsset = batch.assets.find((asset) => asset.role === "cover");
      const zipAsset = batch.assets.find((asset) => asset.role === "zip");
      if (trackAssets.length > MAX_TRACKS_PER_ALBUM) {
        throw new HttpsError("invalid-argument", "Too many tracks.");
      }

      const metadata = normalizeMetadata(data.metadata);
      const trackTitles = normalizeTrackTitles(
        data.trackTitles,
        trackAssets.length
      );

      const adapter = getStorageAdapter();
      for (const asset of batch.assets) {
        if (asset.multipart) {
          const trackIndex =
            asset.role === "track" ? trackAssets.indexOf(asset) : undefined;
          await verifyMultipart(
            adapter,
            asset,
            clientPartsFor(data.parts, asset.role, trackIndex),
            batch.mode
          );
        }
        await verifyObject(adapter, asset, batchId);
      }

      const baseUrl = mediaBaseUrl();
      const sink = isMediaEmulator();
      const finalizedAt = Date.now();
      const now = Date.now();
      const updates: Record<string, unknown> = {};

      let recordId: string;
      let record: Record<string, unknown>;

      if (batch.kind === "video") {
        if (!videoAsset) {
          throw failed("Upload batch is incomplete.");
        }
        const storageName = videoAsset.key.slice(
          "Video/".length,
          -".mp4".length
        );
        const iconKey = thumbnailAsset
          ? thumbnailAsset.key
          : `Video/Icons/${storageName}.jpg`;

        if (batch.mode === "replace") {
          if (!batch.mediaId) {
            throw failed(REPLACE_REJECTED);
          }
          const existing = ((await db.ref(`media/${batch.mediaId}`).get()).val() ??
            null) as MediaRecord | null;
          const storage = existing?.storage;
          if (
            !existing ||
            existing.type !== "video" ||
            storage?.managed !== true ||
            storage.key !== videoAsset.key ||
            storage.iconKey !== iconKey
          ) {
            throw failed(REPLACE_REJECTED);
          }
          recordId = batch.mediaId;
        } else {
          await assertNoCreateDuplicate(
            db,
            "fileName",
            `${storageName}.mp4`,
            videoAsset.key,
            batchId
          );
          const id = db.ref("media").push().key;
          if (!id) {
            throw new HttpsError("internal", "Could not create a media id.");
          }
          recordId = id;
        }

        record = {
          id: recordId,
          title: metadata.title,
          artist: "",
          date: metadata.date,
          fileName: `${storageName}.mp4`,
          folderName: "",
          urls: {
            download: mediaUrl(baseUrl, videoAsset.key, sink),
            icon: mediaUrl(baseUrl, iconKey, sink),
          },
          type: "video",
          format: "video/mp4",
          dateUpdated: now,
          duration: metadata.duration,
          isSticky: metadata.isSticky,
          isHidden: metadata.isHidden,
          listing: [],
          storage: {
            managed: true,
            key: videoAsset.key,
            iconKey,
            bytes: videoAsset.size,
            contentType: videoAsset.contentType,
            batchId,
          },
        };
        updates[`media/${recordId}`] = record;

        if (batch.mode === "replace") {
          await db.ref().update({
            ...updates,
            [`mediaUploads/${batchId}/status`]: "finalized",
            [`mediaUploads/${batchId}/resultId`]: recordId,
            [`mediaUploads/${batchId}/finalizedAt`]: finalizedAt,
          });
          try {
            await adapter.invalidate([videoAsset.key, iconKey]);
          } catch (err) {
            console.error("Could not invalidate media paths", err);
          }
          return { id: recordId, record };
        }
      } else {
        if (!coverAsset || !zipAsset) {
          throw failed("Upload batch is incomplete.");
        }
        const coverKey = coverAsset.key;
        const folder = coverKey
          .replace(/^Music\/Albums\/Covers\//, "")
          .replace(/\.jpg$/, "");
        const folderPath = `Music/Albums/${folder}`;
        await assertNoCreateDuplicate(
          db,
          "folderName",
          folder,
          folder,
          batchId
        );
        const albumIcon = mediaUrl(baseUrl, coverKey, sink);
        const albumId = db.ref("media").push().key;
        if (!albumId) {
          throw new HttpsError("internal", "Could not create a media id.");
        }
        const trackIds = trackAssets.map(() => {
          const id = db.ref("media").push().key;
          if (!id) {
            throw new HttpsError("internal", "Could not create a media id.");
          }
          return id;
        });

        trackAssets.forEach((asset, index) => {
          const fileName = asset.key.slice(`${folderPath}/`.length);
          updates[`media/${trackIds[index]}`] = {
            id: trackIds[index],
            title: trackTitles[index],
            artist: "",
            date: metadata.date,
            urls: {
              download: mediaUrl(baseUrl, asset.key, sink),
              icon: albumIcon,
            },
            type: "audio-track",
            format: "audio/mpeg",
            fileName,
            folderName: "",
            dateUpdated: now,
            isSticky: false,
            isHidden: false,
            listing: [],
            storage: {
              managed: true,
              key: asset.key,
              albumId,
              bytes: asset.size,
              contentType: asset.contentType,
              batchId,
            },
          };
        });

        record = {
          id: albumId,
          title: metadata.title,
          artist: "",
          date: metadata.date,
          folderName: folder,
          urls: {
            download: mediaUrl(baseUrl, zipAsset.key, sink),
            icon: albumIcon,
          },
          type: "audio-album",
          format: "collection/audio",
          dateUpdated: now,
          isSticky: metadata.isSticky,
          isHidden: metadata.isHidden,
          listing: trackIds,
          storage: {
            managed: true,
            folder: folderPath,
            coverKey,
            zipKey: zipAsset.key,
            trackKeys: trackAssets.map((asset) => asset.key),
            batchId,
          },
        };
        updates[`media/${albumId}`] = record;
        recordId = albumId;
      }

      updates[`mediaUploads/${batchId}/status`] = "finalized";
      updates[`mediaUploads/${batchId}/resultId`] = recordId;
      updates[`mediaUploads/${batchId}/finalizedAt`] = finalizedAt;
      await db.ref().update(updates);

      return { id: recordId, record };
    } catch (err) {
      await releaseFinalizeClaim(db, batchId);
      throw err;
    }
  }
);
