import type { Database } from "firebase-admin/database";
import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { rateLimit } from "./helpers";
import { requireMediaAdmin } from "./media/auth";
import type { MediaUploadBatch } from "./media/batch";
import {
  MEDIA_AWS_ACCESS_KEY_ID,
  MEDIA_AWS_REGION,
  MEDIA_AWS_SECRET_ACCESS_KEY,
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  MEDIA_S3_BUCKET,
  isMediaEmulator,
} from "./media/config";
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

const RECORD_REMOVAL_WARNING =
  "Could not remove the media records. Retry the delete.";
const INVALIDATION_WARNING = "Could not invalidate deleted media paths.";

interface MediaStorage {
  managed?: boolean;
  key?: string;
  iconKey?: string;
  folder?: string;
  coverKey?: string;
  zipKey?: string;
  trackKeys?: string[];
  albumId?: string;
}

interface MediaRecord {
  id?: string;
  type?: string;
  listing?: string[];
  storage?: MediaStorage;
}

export interface MediaDeletion {
  deletionId: string;
  mediaIds: string[];
  keys: string[];
  uid: string;
  createdAt: number;
  status: "pending" | "completed";
  failedKeys: string[];
  parentId?: string;
  parentTrackKey?: string;
}

interface DeletionPlan {
  mediaIds: string[];
  keys: string[];
  managed: boolean;
  parent?: { id: string; record: MediaRecord; key: string };
}

function invalid(message: string): HttpsError {
  return new HttpsError("invalid-argument", message);
}

function failed(message: string): HttpsError {
  return new HttpsError("failed-precondition", message);
}

function isManaged(record: MediaRecord | null): boolean {
  return record?.storage?.managed === true;
}

async function loadRecord(
  db: Database,
  id: string
): Promise<MediaRecord | null> {
  return ((await db.ref(`media/${id}`).get()).val() ?? null) as MediaRecord | null;
}

export async function completeDeletionRecords(
  db: Database,
  deletionId: string,
  deletion: Pick<MediaDeletion, "mediaIds" | "parentId" | "parentTrackKey">
): Promise<boolean> {
  try {
    const updates: Record<string, unknown> = {};
    for (const id of deletion.mediaIds) {
      updates[`media/${id}`] = null;
    }
    if (deletion.parentId) {
      const parent = await loadRecord(db, deletion.parentId);
      if (parent) {
        updates[`media/${deletion.parentId}/listing`] = (
          parent.listing ?? []
        ).filter((id) => id !== deletionId);
        updates[`media/${deletion.parentId}/storage/trackKeys`] = (
          parent.storage?.trackKeys ?? []
        ).filter((key) => key !== deletion.parentTrackKey);
      }
    }
    updates[`mediaDeletions/${deletionId}/status`] = "completed";
    updates[`mediaDeletions/${deletionId}/failedKeys`] = [];
    await db.ref().update(updates);
    return true;
  } catch (err) {
    console.error("Could not remove deleted media records", err);
    return false;
  }
}

async function planDeletion(
  db: Database,
  mediaId: string,
  record: MediaRecord
): Promise<DeletionPlan> {
  if (record.type === "audio-album") {
    const listing = Array.isArray(record.listing) ? record.listing : [];
    const tracks = await Promise.all(
      listing.map((id) => loadRecord(db, id))
    );
    const managed =
      isManaged(record) && tracks.every((track) => isManaged(track));
    const storage = record.storage;
    const keys = managed
      ? [
          ...(storage?.trackKeys ?? []),
          storage?.coverKey,
          storage?.zipKey,
        ].filter((key): key is string => typeof key === "string")
      : [];
    return {
      mediaIds: [mediaId, ...listing],
      keys: [...new Set(keys)],
      managed,
    };
  }

  if (record.type === "audio-track") {
    const albumId = record.storage?.albumId;
    const parent = albumId ? await loadRecord(db, albumId) : null;
    const managed = isManaged(record) && isManaged(parent);
    const key = record.storage?.key;
    return {
      mediaIds: [mediaId],
      keys: managed && key ? [key] : [],
      managed,
      parent:
        managed && parent && albumId && key
          ? { id: albumId, record: parent, key }
          : undefined,
    };
  }

  const managed = isManaged(record);
  const storage = record.storage;
  const keys = managed
    ? [storage?.key, storage?.iconKey].filter(
        (key): key is string => typeof key === "string"
      )
    : [];
  return { mediaIds: [mediaId], keys: [...new Set(keys)], managed };
}

function invalidationPaths(keys: string[]): string[] {
  const paths = new Set<string>();
  for (const key of keys) {
    if (!key.startsWith("Music/Albums/")) {
      paths.add(`/${key}`);
      continue;
    }
    const rest = key.slice("Music/Albums/".length);
    if (rest.startsWith("Covers/")) {
      paths.add(`/Music/Albums/Covers/${rest.slice("Covers/".length)}`);
    } else if (rest.startsWith("Zips/")) {
      paths.add(`/Music/Albums/Zips/${rest.slice("Zips/".length)}`);
    } else {
      paths.add(`/Music/Albums/${rest.split("/")[0]}/*`);
    }
  }
  return [...paths];
}

async function invalidate(
  adapter: StorageAdapter,
  keys: string[],
  warnings: string[]
): Promise<void> {
  const paths = invalidationPaths(keys);
  if (paths.length === 0) {
    return;
  }
  try {
    await adapter.invalidate(paths);
  } catch (err) {
    console.error("Could not invalidate deleted media paths", err);
    warnings.push(INVALIDATION_WARNING);
  }
}

async function deleteObjects(
  adapter: StorageAdapter,
  keys: string[]
): Promise<{ deleted: number; warnings: string[] }> {
  const result = await adapter.deleteMany(keys);
  for (const key of keys) {
    if ((await adapter.head(key)).exists) {
      throw failed(`Could not delete "${key}". Retry the delete.`);
    }
  }
  return { deleted: result.deleted, warnings: [...result.warnings] };
}

async function finishDeletion(
  db: Database,
  adapter: StorageAdapter,
  deletion: MediaDeletion,
  deleted: number,
  warnings: string[]
): Promise<{ id: string; objectsDeleted: number; warnings: string[] }> {
  const removed = await completeDeletionRecords(
    db,
    deletion.deletionId,
    deletion
  );
  if (!removed) {
    warnings.push(RECORD_REMOVAL_WARNING);
    return {
      id: deletion.deletionId,
      objectsDeleted: deleted,
      warnings,
    };
  }
  await invalidate(adapter, deletion.keys, warnings);
  return { id: deletion.deletionId, objectsDeleted: deleted, warnings };
}

async function resumeDeletion(
  db: Database,
  adapter: StorageAdapter,
  deletion: MediaDeletion
): Promise<{ id: string; objectsDeleted: number; warnings: string[] }> {
  const { deleted, warnings } = await deleteObjects(adapter, deletion.keys);
  return finishDeletion(db, adapter, deletion, deleted, warnings);
}

async function deleteById(
  db: Database,
  adapter: StorageAdapter,
  uid: string,
  mediaId: string
): Promise<Record<string, unknown>> {
  const record = await loadRecord(db, mediaId);
  if (!record) {
    const deletion = ((await db.ref(`mediaDeletions/${mediaId}`).get()).val() ??
      null) as MediaDeletion | null;
    if (deletion?.status === "pending") {
      return resumeDeletion(db, adapter, deletion);
    }
    throw new HttpsError("not-found", "Media record not found.");
  }

  const plan = await planDeletion(db, mediaId, record);
  if (!plan.managed) {
    const updates: Record<string, unknown> = {};
    for (const id of plan.mediaIds) {
      updates[`media/${id}`] = null;
    }
    await db.ref().update(updates);
    return { id: mediaId, objectsDeleted: 0, warnings: [] };
  }

  const { deleted, warnings } = await deleteObjects(adapter, plan.keys);
  const ledger: MediaDeletion = {
    deletionId: mediaId,
    mediaIds: plan.mediaIds,
    keys: plan.keys,
    uid,
    createdAt: Date.now(),
    status: "pending",
    failedKeys: [],
    ...(plan.parent
      ? { parentId: plan.parent.id, parentTrackKey: plan.parent.key }
      : {}),
  };
  await db.ref(`mediaDeletions/${mediaId}`).set(ledger);
  return finishDeletion(db, adapter, ledger, deleted, warnings);
}

async function cancelBatch(
  db: Database,
  adapter: StorageAdapter,
  uid: string,
  batchId: string
): Promise<Record<string, unknown>> {
  const batch = ((await db.ref(`mediaUploads/${batchId}`).get()).val() ??
    null) as MediaUploadBatch | null;
  if (!batch || batch.uid !== uid) {
    throw failed("Upload batch not found.");
  }
  if (batch.status !== "ticketed") {
    throw failed("Only a ticketed upload can be canceled.");
  }

  if (batch.mode === "replace") {
    for (const asset of batch.assets) {
      if (asset.multipart && asset.uploadId) {
        await adapter.abortMultipart(asset.key, asset.uploadId);
      }
    }
    await db.ref(`mediaUploads/${batchId}`).set(null);
    return { batchId, objectsDeleted: 0 };
  }

  const { deleted } = await deleteObjects(
    adapter,
    batch.assets.map((asset) => asset.key)
  );
  for (const asset of batch.assets) {
    if (asset.multipart && asset.uploadId) {
      await adapter.abortMultipart(asset.key, asset.uploadId);
    }
  }
  await db.ref(`mediaUploads/${batchId}`).set(null);
  return { batchId, objectsDeleted: deleted };
}

export const deleteMedia = onCall(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 120,
    secrets: MEDIA_SECRETS,
  },
  async (request) => {
    const uid = await requireMediaAdmin(request);
    if (!(await rateLimit("media-delete", uid, 60, 3600000))) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Try again later."
      );
    }

    const data = (request.data ?? {}) as Record<string, unknown>;
    const mediaId = typeof data.mediaId === "string" ? data.mediaId : "";
    const batchId = typeof data.batchId === "string" ? data.batchId : "";
    if (Boolean(mediaId) === Boolean(batchId)) {
      throw invalid("Provide exactly one of mediaId or batchId.");
    }

    const db = getDatabase();
    const adapter = getStorageAdapter();
    return batchId
      ? cancelBatch(db, adapter, uid, batchId)
      : deleteById(db, adapter, uid, mediaId);
  }
);
