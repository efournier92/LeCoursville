import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { actorHashFromRequest, checkRateLimit, rateLimit } from "./helpers";

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

    const actor = actorHashFromRequest(request.rawRequest);
    const perActorOk = actor
      ? await checkRateLimit("userUploadsIp", actor, PER_ACTOR_MAX, WINDOW_MS)
      : true;
    const globalOk = await checkRateLimit(
      "userUploadsGlobal",
      "global",
      GLOBAL_MAX,
      WINDOW_MS
    );
    if (!perActorOk || !globalOk) {
      throw new HttpsError("resource-exhausted", "Too many uploads. Try again later.");
    }

    // Commit only after every layer would allow, so a call denied by a later
    // layer does not burn quota on the earlier ones.
    const actorCommitted = actor
      ? await rateLimit("userUploadsIp", actor, PER_ACTOR_MAX, WINDOW_MS)
      : true;
    const globalCommitted = await rateLimit(
      "userUploadsGlobal",
      "global",
      GLOBAL_MAX,
      WINDOW_MS
    );
    if (!actorCommitted || !globalCommitted) {
      throw new HttpsError("resource-exhausted", "Too many uploads. Try again later.");
    }

    const fileName = safeSegment(data.fileName, "upload");
    const batchId = safeSegment(data.batchId, "");
    const fileSize = Number(data.fileSize);
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
      fileSize: Number.isFinite(fileSize) ? Math.max(0, Math.trunc(fileSize)) : 0,
    });

    return { id, path };
  }
);
