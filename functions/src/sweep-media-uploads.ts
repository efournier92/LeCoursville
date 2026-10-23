import { getDatabase } from "firebase-admin/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { REGION } from "./config";
import { completeDeletionRecords, type MediaDeletion } from "./delete-media";
import type { MediaUploadBatch } from "./media/batch";
import {
  MEDIA_AWS_ACCESS_KEY_ID,
  MEDIA_AWS_REGION,
  MEDIA_AWS_SECRET_ACCESS_KEY,
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  MEDIA_S3_BUCKET,
  SWEEP_GRACE_MS,
  isMediaEmulator,
} from "./media/config";
import { getStorageAdapter } from "./media/storage-adapter";

const MEDIA_SECRETS = isMediaEmulator()
  ? []
  : [
    MEDIA_AWS_REGION,
    MEDIA_AWS_ACCESS_KEY_ID,
    MEDIA_AWS_SECRET_ACCESS_KEY,
    MEDIA_S3_BUCKET,
    MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  ];

const SWEEP_PAGE_SIZE = 100;

interface SweepRecord {
  storage?: { batchId?: string };
}

export interface BatchSweepResult {
  action: "skipped" | "removed" | "kept";
  objectsDeleted: number;
  multipartUploadsAborted: number;
}

export interface DeletionSweepResult {
  objectsDeleted: number;
  completed: boolean;
}

function firstRecordForBatch(
  records: Record<string, SweepRecord> | null,
  batchId: string
): string | null {
  for (const [id, record] of Object.entries(records ?? {})) {
    if (record?.storage?.batchId === batchId) {
      return id;
    }
  }
  return null;
}

export async function sweepUploadBatch(
  batchId: string,
  batch: MediaUploadBatch,
  now = Date.now()
): Promise<BatchSweepResult> {
  if (
    batch.status === "finalized" ||
    now - batch.lastActivityAt < SWEEP_GRACE_MS
  ) {
    return { action: "skipped", objectsDeleted: 0, multipartUploadsAborted: 0 };
  }

  const db = getDatabase();
  const adapter = getStorageAdapter();
  const records = (await db.ref("media").get()).val() as Record<
    string,
    SweepRecord
  > | null;
  const recordId = firstRecordForBatch(records, batchId);
  if (recordId) {
    await db.ref(`mediaUploads/${batchId}`).update({
      status: "finalized",
      resultId: recordId,
    });
    return { action: "kept", objectsDeleted: 0, multipartUploadsAborted: 0 };
  }

  const { deleted } = await adapter.deleteMany(
    batch.assets.map((asset) => asset.key)
  );
  let aborted = 0;
  for (const asset of batch.assets) {
    if (asset.multipart && asset.uploadId) {
      await adapter.abortMultipart(asset.key, asset.uploadId);
      aborted += 1;
    }
  }
  await db.ref(`mediaUploads/${batchId}`).set(null);
  return {
    action: "removed",
    objectsDeleted: deleted,
    multipartUploadsAborted: aborted,
  };
}

export async function sweepPendingDeletion(
  deletionId: string,
  deletion: MediaDeletion
): Promise<DeletionSweepResult> {
  if (deletion.status !== "pending") {
    return { objectsDeleted: 0, completed: false };
  }

  const db = getDatabase();
  const adapter = getStorageAdapter();
  const { deleted } = await adapter.deleteMany(deletion.keys);
  const remaining: string[] = [];
  for (const key of deletion.keys) {
    if ((await adapter.head(key)).exists) {
      remaining.push(key);
    }
  }
  if (remaining.length > 0) {
    await db.ref(`mediaDeletions/${deletionId}`).update({
      failedKeys: remaining,
    });
    return { objectsDeleted: deleted, completed: false };
  }
  const removed = await completeDeletionRecords(db, deletionId, deletion);
  if (!removed) {
    return { objectsDeleted: deleted, completed: false };
  }
  return { objectsDeleted: deleted, completed: true };
}

export const sweepMediaUploads = onSchedule(
  {
    region: REGION,
    schedule: "every day 00:00",
    memory: "256MiB",
    timeoutSeconds: 300,
    secrets: MEDIA_SECRETS,
  },
  async () => {
    const db = getDatabase();
    const now = Date.now();
    const cutoff = now - SWEEP_GRACE_MS;
    let batchesScanned = 0;
    let objectsDeleted = 0;
    let multipartUploadsAborted = 0;

    let cursor: { value: number; key: string } | null = null;
    for (;;) {
      let query = db.ref("mediaUploads").orderByChild("lastActivityAt");
      if (cursor) {
        query = query.startAt(cursor.value, cursor.key);
      }
      const snapshot = await query.endAt(cutoff).limitToFirst(SWEEP_PAGE_SIZE).get();
      let entries = Object.entries(
        (snapshot.val() ?? {}) as Record<string, MediaUploadBatch>
      );
      if (cursor) {
        const start = cursor;
        entries = entries.filter(
          ([id, batch]) =>
            !(id === start.key && batch.lastActivityAt === start.value)
        );
      }
      if (entries.length === 0) {
        break;
      }
      for (const [id, batch] of entries) {
        batchesScanned += 1;
        try {
          const result = await sweepUploadBatch(id, batch, now);
          objectsDeleted += result.objectsDeleted;
          multipartUploadsAborted += result.multipartUploadsAborted;
        } catch (err) {
          console.error("Could not sweep media batch", err);
        }
      }
      if (entries.length < SWEEP_PAGE_SIZE) {
        break;
      }
      const [lastId, lastBatch] = entries[entries.length - 1];
      cursor = { value: lastBatch.lastActivityAt, key: lastId };
    }

    const deletions = (await db.ref("mediaDeletions").get()).val() as Record<
      string,
      MediaDeletion
    > | null;
    for (const [id, deletion] of Object.entries(deletions ?? {})) {
      if (deletion.status !== "pending") {
        continue;
      }
      try {
        const result = await sweepPendingDeletion(id, deletion);
        objectsDeleted += result.objectsDeleted;
      } catch (err) {
        console.error("Could not sweep pending media deletion", err);
      }
    }

    console.log("Media sweep counts", {
      batchesScanned,
      objectsDeleted,
      multipartUploadsAborted,
    });
  }
);
