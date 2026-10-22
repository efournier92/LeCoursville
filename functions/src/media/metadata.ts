import { HttpsError } from "firebase-functions/v2/https";

export interface NormalizedMediaMetadata {
  title: string;
  date: string;
  isSticky: boolean;
  isHidden: boolean;
  duration: string;
}

const DURATION_PATTERN = /^\d{1,}:\d{2}(?::\d{2})?$/;

function invalidMetadata(): HttpsError {
  return new HttpsError("invalid-argument", "Invalid metadata.");
}

export function normalizeMetadata(input: unknown): NormalizedMediaMetadata {
  const data = (input ?? {}) as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (title.length < 1 || title.length > 200) {
    throw invalidMetadata();
  }
  const date = typeof data.date === "string" ? data.date.trim() : "";
  if (date.length < 4 || date.length > 40) {
    throw invalidMetadata();
  }
  const duration = typeof data.duration === "string" ? data.duration.trim() : "";
  if (duration && !DURATION_PATTERN.test(duration)) {
    throw invalidMetadata();
  }
  return {
    title,
    date,
    isSticky: data.isSticky === true,
    isHidden: data.isHidden === true,
    duration,
  };
}

/** Returns one trimmed 1 to 200 character title per expected batch track. */
export function normalizeTrackTitles(input: unknown, expected: number): string[] {
  if (expected === 0) {
    return [];
  }
  if (!Array.isArray(input) || input.length !== expected) {
    throw invalidMetadata();
  }
  return input.map((value) => {
    const title = typeof value === "string" ? value.trim() : "";
    if (title.length < 1 || title.length > 200) {
      throw invalidMetadata();
    }
    return title;
  });
}
