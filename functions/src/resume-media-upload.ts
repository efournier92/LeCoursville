import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { rateLimit } from "./helpers";
import { requireMediaAdmin } from "./media/auth";
import type { MediaUploadBatch } from "./media/batch";
import {
  MULTIPART_PART_BYTES,
  TICKET_TTL_SECONDS,
  MEDIA_AWS_ACCESS_KEY_ID,
  MEDIA_AWS_REGION,
  MEDIA_AWS_SECRET_ACCESS_KEY,
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  MEDIA_S3_BUCKET,
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

const ASSET_ROLES = new Set(["video", "thumbnail", "track", "cover", "zip"]);
const MAX_PARTS_PER_CALL = 100;
const BATCH_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function invalid(message: string): HttpsError {
  return new HttpsError("invalid-argument", message);
}

function failed(message: string): HttpsError {
  return new HttpsError("failed-precondition", message);
}

function requestedPartNumbers(value: unknown, partCount: number): number[] {
  if (value === undefined || value === null) {
    return Array.from({ length: partCount }, (_, index) => index + 1);
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw invalid("Invalid part numbers.");
  }
  if (value.length > MAX_PARTS_PER_CALL) {
    throw invalid(
      `At most ${MAX_PARTS_PER_CALL} part numbers can be requested at once.`
    );
  }
  const seen = new Set<number>();
  const numbers: number[] = [];
  for (const raw of value) {
    if (
      typeof raw !== "number" ||
      !Number.isInteger(raw) ||
      raw < 1 ||
      raw > partCount
    ) {
      throw invalid("Invalid part numbers.");
    }
    if (!seen.has(raw)) {
      seen.add(raw);
      numbers.push(raw);
    }
  }
  return numbers;
}

export const resumeMediaUpload = onCall(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: MEDIA_SECRETS,
  },
  async (request) => {
    const uid = await requireMediaAdmin(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const batchId = typeof data.batchId === "string" ? data.batchId : "";
    if (!batchId) {
      throw invalid("A batch id is required.");
    }
    if (!BATCH_ID_PATTERN.test(batchId)) {
      throw invalid("Invalid batch id.");
    }
    if (!(await rateLimit("media-resume", uid, 500, 3600000))) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many uploads. Try again later."
      );
    }
    if (!(await rateLimit("media-resume-batch", batchId, 400, 3600000))) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many uploads. Try again later."
      );
    }

    const db = getDatabase();
    const batch = ((await db.ref(`mediaUploads/${batchId}`).get()).val() ??
      null) as MediaUploadBatch | null;
    if (!batch || batch.uid !== uid || batch.status !== "ticketed") {
      throw failed("Upload batch is not available.");
    }

    const role = typeof data.role === "string" ? data.role : "";
    if (!ASSET_ROLES.has(role)) {
      throw invalid("Unknown asset role.");
    }
    let asset: MediaUploadBatch["assets"][number] | undefined;
    if (role === "track") {
      const trackIndex = data.trackIndex;
      if (typeof trackIndex !== "number" || !Number.isInteger(trackIndex)) {
        throw invalid("A track index is required.");
      }
      asset = batch.assets.filter((entry) => entry.role === "track")[trackIndex];
    } else {
      asset = batch.assets.find((entry) => entry.role === role);
    }
    if (!asset) {
      throw invalid("Upload asset not found.");
    }

    const adapter = getStorageAdapter();
    const now = Date.now();

    if (data.verifyOnly === true) {
      const head = await adapter.head(asset.key);
      await db.ref(`mediaUploads/${batchId}/lastActivityAt`).set(now);
      return {
        uploads: [],
        verification: {
          exists: head.exists,
          batchMatches: head.metadata?.["upload-batch"] === batchId,
          ...(head.exists && head.size !== undefined ? { size: head.size } : {}),
          ...(head.exists && head.contentType
            ? { contentType: head.contentType }
            : {}),
        },
      };
    }

    if (asset.multipart) {
      if (!asset.uploadId) {
        throw failed("Multipart upload was not initialized.");
      }
      const partCount = Math.ceil(asset.size / MULTIPART_PART_BYTES);
      const partNumbers = requestedPartNumbers(data.partNumbers, partCount).slice(
        0,
        MAX_PARTS_PER_CALL
      );
      const parts = await adapter.presignParts({
        key: asset.key,
        uploadId: asset.uploadId,
        partNumbers,
        expiresInSeconds: TICKET_TTL_SECONDS,
      });
      await db.ref(`mediaUploads/${batchId}/lastActivityAt`).set(now);
      return {
        uploads: [
          {
            role: asset.role,
            key: asset.key,
            mode: "multipart",
            uploadId: asset.uploadId,
            partSize: MULTIPART_PART_BYTES,
            partCount,
            parts: parts.map((part) => ({
              partNumber: part.partNumber,
              url: part.url,
              headers: {},
            })),
          },
        ],
      };
    }

    let etag: string | undefined;
    if (batch.mode === "replace") {
      const head = await adapter.head(asset.key);
      if (!head.exists || !head.etag) {
        throw failed("The file to replace is missing.");
      }
      etag = head.etag;
    }
    const ticket = await adapter.presignPut({
      key: asset.key,
      contentType: asset.contentType,
      batchId,
      mode: batch.mode,
      etag,
      expiresInSeconds: TICKET_TTL_SECONDS,
    });
    await db.ref(`mediaUploads/${batchId}/lastActivityAt`).set(now);
    return {
      uploads: [
        {
          role: asset.role,
          key: asset.key,
          mode: "single",
          url: ticket.url,
          method: "PUT",
          headers: ticket.headers,
          expiresAt: ticket.expiresAt,
        },
      ],
    };
  }
);
