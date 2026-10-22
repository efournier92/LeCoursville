import JSZip from "jszip";
import { vi } from "vitest";
import { BROWSER_ZIP_MAX_BYTES } from "src/app/constants/media-upload-constants";
import {
  ALBUM_ZIP_ERROR,
  albumZipBytes,
  albumZipName,
  generateAlbumZip,
} from "./album-zip";

function track(name: string, bytes: number[]): { name: string; file: Blob } {
  return { name, file: new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }) };
}

const TRACKS = [
  track("01+-+First.mp3", [1, 2, 3]),
  track("02+-+Second.mp3", [4, 5, 6, 7]),
];

describe("album zip", () => {
  afterEach(() => vi.restoreAllMocks());

  it("generates a STORE zip under the cap with every track in list order", async () => {
    const spy = vi.spyOn(JSZip.prototype, "generateAsync");

    const result = await generateAlbumZip("Le+Cours", TRACKS);

    expect(result.status).toBe("generated");
    expect(result.name).toBe("Zips/Le+Cours.zip");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "blob", compression: "STORE" })
    );
    expect("blob" in result && result.blob.size).toBeGreaterThan(0);

    const loaded = await JSZip.loadAsync((result as { blob: Blob }).blob);
    const names = Object.keys(loaded.files).filter(name => !loaded.files[name].dir);
    expect(names).toEqual(["01+-+First.mp3", "02+-+Second.mp3"]);
    expect(Array.from(await loaded.files[names[0]].async("uint8array"))).toEqual([1, 2, 3]);
    expect(Array.from(await loaded.files[names[1]].async("uint8array"))).toEqual([4, 5, 6, 7]);
  });

  it("skips generation above the cap and requires the manual input", async () => {
    const spy = vi.spyOn(JSZip.prototype, "generateAsync");

    const result = await generateAlbumZip("Le+Cours", TRACKS, BROWSER_ZIP_MAX_BYTES + 1);

    expect(result).toEqual({ status: "manual", name: "Zips/Le+Cours.zip" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns the documented error when generation fails", async () => {
    vi.spyOn(JSZip.prototype, "generateAsync").mockRejectedValueOnce(new Error("boom"));

    const result = await generateAlbumZip("Le+Cours", TRACKS);

    expect(result).toEqual({
      status: "error",
      name: "Zips/Le+Cours.zip",
      error: ALBUM_ZIP_ERROR,
    });
  });

  it("names the blob Zips/<folder>.zip and sums track bytes", () => {
    expect(albumZipName("Le+Cours")).toBe("Zips/Le+Cours.zip");
    expect(albumZipBytes(TRACKS)).toBe(7);
  });
});
