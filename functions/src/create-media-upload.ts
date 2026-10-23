import type { Database } from "firebase-admin/database";
import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { rateLimit } from "./helpers";
import { requireMediaAdmin } from "./media/auth";
import type { MediaBatchAsset, MediaUploadBatch } from "./media/batch";
import {
  MAX_ALBUM_TRACK_BYTES,
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
  MULTIPART_THRESHOLD_BYTES,
  isMediaEmulator,
} from "./media/config";
import {
  albumCoverKey,
  albumZipKey,
  audioFolderName,
  isValidAudioFolderName,
  isValidTrackFileName,
  isValidVideoStorageName,
  trackFileName,
  trackKey,
  trackTitle,
  videoIconKey,
  videoKey,
} from "./media/naming";
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
const ALBUM_REPLACE_REJECTED =
  "Album content cannot be replaced. Delete the album and upload it again.";

interface VideoRecord {
  type?: string;
  storage?: {
    managed?: boolean;
    key?: string;
    iconKey?: string;
  };
}

function invalid(message: string): HttpsError {
  return new HttpsError("invalid-argument", message);
}

function failed(message: string): HttpsError {
  return new HttpsError("failed-precondition", message);
}

function alreadyExists(message: string): HttpsError {
  return new HttpsError("already-exists", message);
}

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(message);
  }
  return value as Record<string, unknown>;
}

function requireSize(value: unknown, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw invalid(`${label} must be a positive integer number of bytes.`);
  }
  if (value > max) {
    throw invalid(`${label} must be ${max} bytes or smaller.`);
  }
  return value;
}

function requireContentType(
  value: unknown,
  expected: string,
  label: string
): string {
  if (value !== expected) {
    throw invalid(`${label} must have content type "${expected}".`);
  }
  return expected;
}

function makeAsset(
  role: MediaBatchAsset["role"],
  key: string,
  contentType: string,
  size: number
): MediaBatchAsset {
  return {
    role,
    key,
    contentType,
    size,
    multipart: false,
    uploadId: null,
    parts: [],
  };
}

async function assertNoCreateCollision(
  adapter: StorageAdapter,
  db: Database,
  keys: string[],
  field: "fileName" | "folderName",
  value: string,
  displayKey: string
): Promise<void> {
  // A record is the stronger signal: its objects are expected to exist, so a
  // re-upload attempt must report the duplicate record, not an orphan object.
  const match = await db.ref("media").orderByChild(field).equalTo(value).get();
  if (match.exists()) {
    throw alreadyExists(
      `A record named "${displayKey}" already exists. Delete it or choose a different name.`
    );
  }
  for (const key of keys) {
    const head = await adapter.head(key);
    if (head.exists) {
      throw alreadyExists(
        `An orphan file named "${key}" exists. Choose a different name; the storage sweep will remove it later.`
      );
    }
  }
}

export const createMediaUpload = onCall(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: MEDIA_SECRETS,
  },
  async (request) => {
    const uid = await requireMediaAdmin(request);
    if (!(await rateLimit("media-create", uid, 20, 3600000))) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many uploads. Try again later."
      );
    }

    const data = (request.data ?? {}) as Record<string, unknown>;
    const kind = data.kind;
    const mode = data.mode;
    if (kind !== "video" && kind !== "audio-album") {
      throw invalid("Invalid upload kind.");
    }
    if (mode !== "create" && mode !== "replace") {
      throw invalid("Invalid upload mode.");
    }

    const db = getDatabase();
    const adapter = getStorageAdapter();
    const batchId = db.ref("mediaUploads").push().key;
    if (!batchId) {
      throw new HttpsError("internal", "Could not create an upload batch.");
    }

    let assets: MediaBatchAsset[];
    let keys: Record<string, unknown>;
    let firstAsset: { role: string; trackIndex?: number };
    let mediaId: string | null = null;

    if (kind === "video") {
      const video = requireObject(data.video, "Invalid video upload.");
      const storageName =
        typeof video.storageName === "string" ? video.storageName : "";
      if (!isValidVideoStorageName(storageName)) {
        throw invalid("Invalid storage name.");
      }
      const size = requireSize(video.size, MAX_VIDEO_BYTES, "Video");
      requireContentType(video.contentType, "video/mp4", "Video");

      let thumbnailSize: number | null = null;
      if (video.thumbnail !== undefined && video.thumbnail !== null) {
        const thumbnail = requireObject(video.thumbnail, "Invalid thumbnail.");
        thumbnailSize = requireSize(
          thumbnail.size,
          MAX_IMAGE_BYTES,
          "Thumbnail"
        );
        requireContentType(thumbnail.contentType, "image/jpeg", "Thumbnail");
      }

      const key = videoKey(storageName);
      const iconKey = videoIconKey(storageName);
      let batchIconKey = iconKey;

      if (mode === "create" && thumbnailSize === null) {
        throw invalid("A thumbnail is required when creating a video.");
      }

      if (mode === "replace") {
        mediaId = typeof data.mediaId === "string" ? data.mediaId : "";
        if (!mediaId) {
          throw invalid("A media id is required to replace.");
        }
        const record = (await db.ref(`media/${mediaId}`).get()).val() as
          | VideoRecord
          | null;
        const storage = record?.storage;
        if (
          !record ||
          record.type !== "video" ||
          storage?.managed !== true ||
          storage.key !== key ||
          storage.iconKey !== iconKey
        ) {
          throw failed(REPLACE_REJECTED);
        }
        batchIconKey = storage.iconKey;
      } else {
        await assertNoCreateCollision(
          adapter,
          db,
          [key, iconKey],
          "fileName",
          `${storageName}.mp4`,
          key
        );
      }

      assets = [makeAsset("video", key, "video/mp4", size)];
      if (thumbnailSize !== null) {
        assets.push(
          makeAsset("thumbnail", iconKey, "image/jpeg", thumbnailSize)
        );
      }
      keys = { video: { key, iconKey: batchIconKey } };
      firstAsset = { role: "video" };
    } else {
      const album = requireObject(data.album, "Invalid album upload.");
      const providedFolder =
        typeof album.folderName === "string" ? album.folderName : "";
      if (!isValidAudioFolderName(providedFolder)) {
        throw invalid("Invalid folder name.");
      }
      const folder = audioFolderName(providedFolder);

      const rawTracks = Array.isArray(album.tracks) ? album.tracks : [];
      if (rawTracks.length < 1 || rawTracks.length > MAX_TRACKS_PER_ALBUM) {
        throw invalid(
          `An album must have between 1 and ${MAX_TRACKS_PER_ALBUM} tracks.`
        );
      }
      const tracks = rawTracks.map((raw) => {
        const track = requireObject(raw, "Invalid track.");
        const sourceFileName =
          typeof track.sourceFileName === "string" ? track.sourceFileName : "";
        const file = trackFileName(sourceFileName);
        if (!isValidTrackFileName(file)) {
          throw invalid("Invalid track file name.");
        }
        return {
          file,
          size: requireSize(track.size, MAX_TRACK_BYTES, "Track"),
          title:
            typeof track.title === "string"
              ? track.title
              : trackTitle(sourceFileName),
        };
      });

      const seen = new Set<string>();
      for (const track of tracks) {
        if (seen.has(track.file)) {
          throw invalid(
            `Two tracks use the same file name: "${track.file}". Rename one track file before uploading.`
          );
        }
        seen.add(track.file);
      }

      const totalTrackBytes = tracks.reduce(
        (sum, track) => sum + track.size,
        0
      );
      if (totalTrackBytes > MAX_ALBUM_TRACK_BYTES) {
        throw invalid(
          `Album tracks must total ${MAX_ALBUM_TRACK_BYTES} bytes or less.`
        );
      }

      const coverInput = requireObject(album.cover, "Invalid cover.");
      const coverSize = requireSize(coverInput.size, MAX_IMAGE_BYTES, "Cover");
      requireContentType(coverInput.contentType, "image/jpeg", "Cover");
      const zipInput = requireObject(album.zip, "Invalid zip.");
      const zipSize = requireSize(zipInput.size, MAX_ZIP_BYTES, "Zip");
      requireContentType(zipInput.contentType, "application/zip", "Zip");

      if (mode === "replace") {
        throw failed(ALBUM_REPLACE_REJECTED);
      }

      const coverKey = albumCoverKey(folder);
      const zipKey = albumZipKey(folder);
      const trackKeys = tracks.map((track) => trackKey(folder, track.file));
      await assertNoCreateCollision(
        adapter,
        db,
        [coverKey, zipKey, ...trackKeys],
        "folderName",
        folder,
        folder
      );

      assets = tracks.map((track) =>
        makeAsset("track", trackKey(folder, track.file), "audio/mpeg", track.size)
      );
      assets.push(makeAsset("cover", coverKey, "image/jpeg", coverSize));
      assets.push(makeAsset("zip", zipKey, "application/zip", zipSize));
      keys = {
        album: {
          folder,
          coverKey,
          zipKey,
          tracks: tracks.map((track) => ({
            key: trackKey(folder, track.file),
            title: track.title,
          })),
        },
      };
      firstAsset = { role: "track", trackIndex: 0 };
    }

    for (const asset of assets) {
      if (!isMediaEmulator() && asset.size > MULTIPART_THRESHOLD_BYTES) {
        const { uploadId } = await adapter.createMultipart({
          key: asset.key,
          contentType: asset.contentType,
          batchId,
        });
        asset.multipart = true;
        asset.uploadId = uploadId;
      }
    }

    const now = Date.now();
    const batch: MediaUploadBatch = {
      kind,
      mode,
      mediaId,
      uid,
      createdAt: now,
      lastActivityAt: now,
      status: "ticketed",
      assets,
      resultId: null,
      finalizedAt: null,
    };
    await db.ref(`mediaUploads/${batchId}`).set(batch).catch(async (err) => {
      for (const asset of assets) {
        if (asset.multipart && asset.uploadId) {
          try {
            await adapter.abortMultipart(asset.key, asset.uploadId);
          } catch (abortErr) {
            console.error(
              "Could not abort an upload after a batch write failure",
              abortErr
            );
          }
        }
      }
      throw err;
    });

    return { batchId, keys, firstAsset };
  }
);
