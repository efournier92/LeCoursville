import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";

interface UploaderInput {
  name?: unknown;
  email?: unknown;
  anonymousId?: unknown;
}

const MAX_SEGMENT = 120;

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
    if (typeof data.fileName !== "string" || data.fileName.trim() === "") {
      throw new HttpsError("invalid-argument", "A file name is required.");
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
