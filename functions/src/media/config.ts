import { defineSecret } from "firebase-functions/params";

export const MEDIA_AWS_REGION = defineSecret("MEDIA_AWS_REGION");
export const MEDIA_AWS_ACCESS_KEY_ID = defineSecret("MEDIA_AWS_ACCESS_KEY_ID");
export const MEDIA_AWS_SECRET_ACCESS_KEY = defineSecret("MEDIA_AWS_SECRET_ACCESS_KEY");
export const MEDIA_S3_BUCKET = defineSecret("MEDIA_S3_BUCKET");
export const MEDIA_CLOUDFRONT_DISTRIBUTION_ID = defineSecret(
  "MEDIA_CLOUDFRONT_DISTRIBUTION_ID"
);

export const MEDIA_BASE_URL = "https://assets.lecoursville.com";

export const MAX_VIDEO_BYTES = 2147483648;
export const MAX_TRACK_BYTES = 209715200;
export const MAX_IMAGE_BYTES = 10485760;
export const MAX_ZIP_BYTES = 2147483648;
export const MAX_TRACKS_PER_ALBUM = 100;
export const MAX_ALBUM_TRACK_BYTES = 2000000000;
export const TICKET_TTL_SECONDS = 900;
export const MULTIPART_THRESHOLD_BYTES = 104857600;
export const MULTIPART_PART_BYTES = 8388608;
export const MAX_PARTS = 10000;
export const SWEEP_GRACE_MS = 86400000;

export function isMediaEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

export function emulatorMediaBaseUrl(): string {
  const project = process.env.GCLOUD_PROJECT || "lecoursville-dev";
  return `http://localhost:5001/${project}/us-central1/emulatorMediaSink`;
}

/** The active base URL; emulator mode points at the local sink. */
export function mediaBaseUrl(): string {
  return isMediaEmulator() ? emulatorMediaBaseUrl() : MEDIA_BASE_URL;
}

export function emulatorMediaUrl(key: string): string {
  return `${emulatorMediaBaseUrl()}?key=${encodeURIComponent(key)}`;
}
