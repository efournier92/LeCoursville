import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import {
  actorHashFromRequest,
  auditRateLimitBreach,
  rateLimit,
  sendAdminAlert,
} from "./helpers";

interface UploaderInput {
  name?: unknown;
  email?: unknown;
  anonymousId?: unknown;
}

const MAX_SEGMENT = 120;
// A guest may upload a whole folder in one session; the cap stays generous
// enough for a legitimate first batch while bounding pending-row spam.
const WINDOW_MS = 60 * 60 * 1000;
export const PER_ACTOR_MAX = 300;
export const GLOBAL_MAX = 1500;
// Control characters would inject line breaks into admin-facing records.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const MAX_FILE_NAME = 255;
const MAX_EVENT_NAME = 200;
const MAX_BATCH_ID = MAX_SEGMENT;
const MAX_CONTENT_TYPE = 100;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_MESSAGE = "Files must be 50 MB or smaller.";
const GLOBAL_ALERT_LIMIT = "userUploadsGlobalAlert";

/**
 * Turns a client-supplied path segment into one safe segment. Public upload
 * accepts arbitrary file names, so separators, traversal, and control bytes
 * must never reach the storage path.
 */
export function safeSegment(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw
    .replace(/[\\/]+/g, "_")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "")
    .slice(0, MAX_SEGMENT);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function withinBounds(value: unknown, max: number): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= max && !CONTROL_CHARS.test(value))
  );
}

function uploaderInfo(value: unknown): Record<string, string> {
  const input = (value ?? {}) as UploaderInput;
  const uploader: Record<string, string> = {};
  const name = boundedText(input.name, 120);
  const email = boundedText(input.email, 160);
  const anonymousId = boundedText(input.anonymousId, 80);
  if (name) uploader.name = name;
  if (email) uploader.email = email;
  if (anonymousId) uploader.anonymousId = anonymousId;
  return uploader;
}

/**
 * The global cap is a poor denial lever: it is reachable by an unauthenticated
 * attacker and would lock out every guest. Above it, keep accepting uploads and
 * raise one throttled alert instead. The throttle write is itself the
 * rate-limit record for the breach.
 */
async function recordGlobalCap(actor: string | null): Promise<void> {
  try {
    const first = await rateLimit(GLOBAL_ALERT_LIMIT, "global", 1, WINDOW_MS);
    if (!first) {
      return;
    }
    await auditRateLimitBreach({
      functionName: "createUserUpload",
      layer: "global",
      emailHash: null,
      actorHash: actor,
    });
    await sendAdminAlert({
      type: "upload_global_cap",
      title: "Upload volume is above the global cap",
      body: `More than ${GLOBAL_MAX} uploads were requested this hour. Uploads stay enabled; review the pending queue.`,
      data: {
        function: "createUserUpload",
        cap: GLOBAL_MAX,
        windowMs: WINDOW_MS,
        actorHash: actor,
      },
    });
  } catch (err) {
    // Alerting must never turn the soft cap back into a hard upload failure.
    console.error("Could not record the upload global cap", err);
  }
}

/**
 * Creates the pending userUploads record for the public upload page. The
 * client can no longer write this tree, so the server owns the id, path,
 * status, and url; the storage object is uploaded to the returned path.
 */
export const createUserUpload = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    const fileNameInput = typeof data.fileName === "string" ? data.fileName : "";
    if (
      fileNameInput.trim() === "" ||
      fileNameInput.length > MAX_FILE_NAME ||
      CONTROL_CHARS.test(fileNameInput) ||
      !withinBounds(data.eventName, MAX_EVENT_NAME) ||
      !withinBounds(data.batchId, MAX_BATCH_ID) ||
      !withinBounds(data.fileType, MAX_CONTENT_TYPE)
    ) {
      throw new HttpsError("invalid-argument", "Invalid upload.");
    }

    const fileSize = Number(data.fileSize);
    if (!Number.isFinite(fileSize) || fileSize < 0 || fileSize > MAX_UPLOAD_BYTES) {
      throw new HttpsError("invalid-argument", MAX_UPLOAD_MESSAGE);
    }

    const actor = actorHashFromRequest(request.rawRequest);
    if (
      actor &&
      !(await rateLimit("userUploadsIp", actor, PER_ACTOR_MAX, WINDOW_MS))
    ) {
      throw new HttpsError("resource-exhausted", "Too many uploads. Try again later.");
    }
    const globalOk = await rateLimit(
      "userUploadsGlobal",
      "global",
      GLOBAL_MAX,
      WINDOW_MS
    );
    if (!globalOk) {
      await recordGlobalCap(actor);
    }

    const fileName = safeSegment(data.fileName, "upload");
    const batchId = safeSegment(data.batchId, "");
    const id = getDatabase().ref("userUploads").push().key;
    if (!id) {
      throw new HttpsError("internal", "Could not create an upload id.");
    }

    const path = batchId
      ? `userUploads/${id}/${batchId}/${fileName}`
      : `userUploads/${id}/${fileName}`;

    await getDatabase().ref(`userUploads/${id}`).set({
      id,
      url: "",
      path,
      dateAdded: Date.now(),
      eventName: boundedText(data.eventName, 200),
      status: "pending",
      uploader: uploaderInfo(data.uploader),
      fileName,
      fileType: boundedText(data.fileType, 100),
      fileSize: Math.trunc(fileSize),
    });

    return { id, path };
  }
);
