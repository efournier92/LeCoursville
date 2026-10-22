import JSZip from "jszip";
import { BROWSER_ZIP_MAX_BYTES } from "src/app/constants/media-upload-constants";

export const ALBUM_ZIP_ERROR = "Album zip generation failed. Retry or choose a zip file.";

export interface AlbumZipTrack {
  name: string;
  file: Blob;
}

export type AlbumZipResult =
  | { status: "generated"; name: string; blob: Blob }
  | { status: "manual"; name: string }
  | { status: "error"; name: string; error: string };

export function albumZipName(folder: string): string {
  return `Zips/${folder}.zip`;
}

export function albumZipBytes(tracks: AlbumZipTrack[]): number {
  return tracks.reduce((total, track) => total + track.file.size, 0);
}

export async function generateAlbumZip(
  folder: string,
  tracks: AlbumZipTrack[],
  totalBytes = albumZipBytes(tracks)
): Promise<AlbumZipResult> {
  const name = albumZipName(folder);
  if (totalBytes > BROWSER_ZIP_MAX_BYTES) {
    return { status: "manual", name };
  }

  try {
    const zip = new JSZip();
    for (const track of tracks) {
      zip.file(track.name, track.file);
    }
    // Audio is already compressed, so STORE avoids a pointless second compression pass.
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    return { status: "generated", name, blob };
  } catch {
    return { status: "error", name, error: ALBUM_ZIP_ERROR };
  }
}
