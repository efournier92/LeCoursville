export const VIDEO_STORAGE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_VIDEO_STORAGE_NAME = 80;
export const MAX_AUDIO_FOLDER_NAME = 100;

const VIDEO_FALLBACK = "video";
const AUDIO_FOLDER_FALLBACK = "album";

// These would change the URL after encodeURI, so the stored URL would no longer round-trip to the object key.
const FORBIDDEN_FOLDER_CHARS = /[/\\:*?"<>|#%&\u0000-\u001f\u007f]/;
const FORBIDDEN_TRACK_CHARS = /[%?#&\u0000-\u001f\u007f/\\]/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Preview mirror of functions/src/media/naming.ts, which is the authority. */
export function videoStorageName(input: string): string {
  const base = typeof input === "string" ? input.replace(/\.[^./\\]*$/, "") : "";
  const normalized = base
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let slug = normalized;
  if (slug.length > MAX_VIDEO_STORAGE_NAME) {
    slug = slug.slice(0, MAX_VIDEO_STORAGE_NAME).replace(/-+$/, "");
  }
  return slug || VIDEO_FALLBACK;
}

export function isValidVideoStorageName(name: string): boolean {
  return (
    typeof name === "string" &&
    name.length >= 1 &&
    name.length <= MAX_VIDEO_STORAGE_NAME &&
    VIDEO_STORAGE_NAME_PATTERN.test(name)
  );
}

export function audioFolderName(input: string): string {
  if (typeof input !== "string") {
    return AUDIO_FOLDER_FALLBACK;
  }
  const folder = input
    .trim()
    .replace(/ +/g, "+")
    .replace(/\+{2,}/g, "+")
    .replace(/^\+|\+$/g, "");
  return folder.slice(0, MAX_AUDIO_FOLDER_NAME).replace(/\+$/, "") || AUDIO_FOLDER_FALLBACK;
}

export function isValidAudioFolderName(name: string): boolean {
  return (
    typeof name === "string" &&
    name.length >= 1 &&
    name.length <= MAX_AUDIO_FOLDER_NAME &&
    !FORBIDDEN_FOLDER_CHARS.test(name) &&
    !CONTROL_CHARS.test(name) &&
    !/^\+|\+$/.test(name)
  );
}

export function trackFileName(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  return input
    .replace(/ +/g, "+")
    .replace(/[/\\]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\.mp3$/i, ".mp3");
}

export function isValidTrackFileName(name: string): boolean {
  return (
    typeof name === "string" &&
    name.length > ".mp3".length &&
    /\.mp3$/i.test(name) &&
    !FORBIDDEN_TRACK_CHARS.test(name)
  );
}

export function trackTitle(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  return input
    .replace(/\.[^./\\]*$/, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

export function videoKey(storageName: string): string {
  return `Video/${storageName}.mp4`;
}

export function videoIconKey(storageName: string): string {
  return `Video/Icons/${storageName}.jpg`;
}

export function albumFolderKey(folder: string): string {
  return `Music/Albums/${folder}`;
}

export function albumCoverKey(folder: string): string {
  return `Music/Albums/Covers/${folder}.jpg`;
}

export function albumZipKey(folder: string): string {
  return `Music/Albums/Zips/${folder}.zip`;
}

export function trackKey(folder: string, fileName: string): string {
  return `Music/Albums/${folder}/${fileName}`;
}

/** encodeURI keeps the legacy plus-for-space convention and encodes non-ASCII without touching "+". */
export function mediaUrl(baseUrl: string, key: string): string {
  return `${baseUrl}/${encodeURI(key)}`;
}

export function videoDownloadUrl(baseUrl: string, storageName: string): string {
  return mediaUrl(baseUrl, videoKey(storageName));
}

export function videoIconUrl(baseUrl: string, storageName: string): string {
  return mediaUrl(baseUrl, videoIconKey(storageName));
}

export function albumDownloadUrl(baseUrl: string, folder: string): string {
  return mediaUrl(baseUrl, albumZipKey(folder));
}

export function albumIconUrl(baseUrl: string, folder: string): string {
  return mediaUrl(baseUrl, albumCoverKey(folder));
}

export function trackDownloadUrl(
  baseUrl: string,
  folder: string,
  fileName: string
): string {
  return mediaUrl(baseUrl, trackKey(folder, fileName));
}
