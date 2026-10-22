import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { rateLimit } from "./helpers";
import { requireMediaAdmin } from "./media/auth";
import {
  MEDIA_AWS_ACCESS_KEY_ID,
  MEDIA_AWS_REGION,
  MEDIA_AWS_SECRET_ACCESS_KEY,
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  MEDIA_S3_BUCKET,
} from "./media/config";
import {
  normalizeMetadata,
  normalizeTrackTitles,
} from "./media/metadata";

const MEDIA_SECRETS = [
  MEDIA_AWS_REGION,
  MEDIA_AWS_ACCESS_KEY_ID,
  MEDIA_AWS_SECRET_ACCESS_KEY,
  MEDIA_S3_BUCKET,
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
];

interface MediaRecord {
  type?: string;
  listing?: string[];
  [field: string]: unknown;
}

function notFound(): HttpsError {
  return new HttpsError("not-found", "Media record not found.");
}

function invalid(message: string): HttpsError {
  return new HttpsError("invalid-argument", message);
}

function isPermutation(candidate: string[], current: string[]): boolean {
  if (candidate.length !== current.length) {
    return false;
  }
  const ids = new Set(candidate);
  return ids.size === candidate.length && current.every((id) => ids.has(id));
}

export const updateMediaMetadata = onCall(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: MEDIA_SECRETS,
  },
  async (request) => {
    const uid = await requireMediaAdmin(request);
    if (!(await rateLimit("media-update", uid, 120, 3600000))) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Try again later."
      );
    }

    const data = (request.data ?? {}) as Record<string, unknown>;
    const mediaId = typeof data.mediaId === "string" ? data.mediaId : "";
    if (!mediaId) {
      throw invalid("A media id is required.");
    }

    const db = getDatabase();
    const record = ((await db.ref(`media/${mediaId}`).get()).val() ??
      null) as MediaRecord | null;
    if (!record) {
      throw notFound();
    }

    const metadata = normalizeMetadata(data);
    const updates: Record<string, unknown> = {
      [`media/${mediaId}/title`]: metadata.title,
      [`media/${mediaId}/date`]: metadata.date,
      [`media/${mediaId}/isSticky`]: metadata.isSticky,
      [`media/${mediaId}/isHidden`]: metadata.isHidden,
      [`media/${mediaId}/dateUpdated`]: Date.now(),
    };
    if (record.type === "video" && typeof data.duration === "string") {
      updates[`media/${mediaId}/duration`] = metadata.duration;
    }

    let trackTitles: string[] | null = null;
    if (record.type === "audio-album") {
      if (data.trackTitles === undefined || data.listing === undefined) {
        throw invalid("Track titles and listing must be supplied together.");
      }
      const current = Array.isArray(record.listing) ? record.listing : [];
      const listing = data.listing;
      if (
        !Array.isArray(listing) ||
        listing.some((id) => typeof id !== "string") ||
        !isPermutation(listing as string[], current)
      ) {
        throw invalid("The listing must be a permutation of the current track ids.");
      }
      trackTitles = normalizeTrackTitles(data.trackTitles, current.length);
      updates[`media/${mediaId}/listing`] = listing;
      (listing as string[]).forEach((trackId, index) => {
        updates[`media/${trackId}/title`] = trackTitles?.[index];
      });
    } else if (data.trackTitles !== undefined || data.listing !== undefined) {
      throw invalid("Track titles and listing apply only to an album.");
    }

    await db.ref().update(updates);

    const updated = ((await db.ref(`media/${mediaId}`).get()).val() ??
      null) as MediaRecord | null;
    if (!trackTitles) {
      return { record: updated };
    }
    const listing = Array.isArray(updated?.listing) ? updated.listing : [];
    const tracks = await Promise.all(
      listing.map(async (id) => (await db.ref(`media/${id}`).get()).val())
    );
    return { record: updated, tracks };
  }
);
