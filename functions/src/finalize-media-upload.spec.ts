import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

vi.mock("./media/storage-adapter", () => {
  const adapter = {
    presignPut: vi.fn(),
    createMultipart: vi.fn(),
    presignParts: vi.fn(),
    listParts: vi.fn(),
    completeMultipart: vi.fn(),
    abortMultipart: vi.fn(),
    head: vi.fn(),
    deleteMany: vi.fn(),
    invalidate: vi.fn(),
  };
  return { getStorageAdapter: () => adapter };
});

import type { MediaBatchAsset, MediaUploadBatch } from "./media/batch";
import { MULTIPART_PART_BYTES } from "./media/config";
import { getStorageAdapter } from "./media/storage-adapter";
import { finalizeMediaUpload } from "./finalize-media-upload";
import { fakeDb, resetFakeState } from "./test-support";

interface AdapterMock {
  head: ReturnType<typeof vi.fn>;
  listParts: ReturnType<typeof vi.fn>;
  completeMultipart: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  invalidate: ReturnType<typeof vi.fn>;
}

const adapter = getStorageAdapter() as unknown as AdapterMock;

const VIDEO_KEY = "Video/clip.mp4";
const ICON_KEY = "Video/Icons/clip.jpg";
const METADATA = { title: "My Clip", date: "2026", duration: "3:45" };

async function seedAdmin(uid = "admin-1"): Promise<void> {
  await fakeDb.ref(`users/${uid}/roles`).set({ user: true, admin: true });
}

function asset(
  role: MediaBatchAsset["role"],
  key: string,
  size: number,
  contentType: string,
  extra: Partial<MediaBatchAsset> = {}
): MediaBatchAsset {
  return {
    role,
    key,
    contentType,
    size,
    multipart: false,
    uploadId: null,
    parts: [],
    ...extra,
  };
}

function videoBatch(overrides: Partial<MediaUploadBatch> = {}): MediaUploadBatch {
  return {
    kind: "video",
    mode: "create",
    mediaId: null,
    uid: "admin-1",
    createdAt: 1,
    lastActivityAt: 1,
    status: "ticketed",
    assets: [
      asset("video", VIDEO_KEY, 1000, "video/mp4"),
      asset("thumbnail", ICON_KEY, 500, "image/jpeg"),
    ],
    resultId: null,
    finalizedAt: null,
    ...overrides,
  };
}

function albumBatch(overrides: Partial<MediaUploadBatch> = {}): MediaUploadBatch {
  return {
    kind: "audio-album",
    mode: "create",
    mediaId: null,
    uid: "admin-1",
    createdAt: 1,
    lastActivityAt: 1,
    status: "ticketed",
    assets: [
      asset("track", "Music/Albums/Le+Cours/01+First.mp3", 100, "audio/mpeg"),
      asset("track", "Music/Albums/Le+Cours/02+Second.mp3", 200, "audio/mpeg"),
      asset("cover", "Music/Albums/Covers/Le+Cours.jpg", 50, "image/jpeg"),
      asset("zip", "Music/Albums/Zips/Le+Cours.zip", 300, "application/zip"),
    ],
    resultId: null,
    finalizedAt: null,
    ...overrides,
  };
}

async function seedBatch(value: MediaUploadBatch, id = "batch-1"): Promise<void> {
  await fakeDb.ref(`mediaUploads/${id}`).set(value);
}

function headFor(
  entries: Record<
    string,
    { size: number; contentType: string; batchId?: string; exists?: boolean }
  >
): void {
  adapter.head.mockImplementation(async (key: string) => {
    const entry = entries[key];
    if (!entry) {
      return { exists: false };
    }
    return {
      exists: entry.exists ?? true,
      size: entry.size,
      contentType: entry.contentType,
      etag: '"etag"',
      metadata: { "upload-batch": entry.batchId ?? "batch-1" },
    };
  });
}

function invoke(
  data: Record<string, unknown>,
  uid: string | null = "admin-1"
) {
  return finalizeMediaUpload.run({
    data,
    auth: uid ? { uid, token: {} } : null,
    rawRequest: {},
  } as never);
}

function mediaRecords(): Record<string, Record<string, unknown>> {
  return (fakeDb.read("media") ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
}

describe("finalizeMediaUpload", () => {
  beforeEach(() => {
    resetFakeState();
    vi.clearAllMocks();
    adapter.deleteMany.mockResolvedValue({ deleted: 0, warnings: [] });
    adapter.invalidate.mockResolvedValue(undefined);
    adapter.head.mockResolvedValue({ exists: false });
    adapter.listParts.mockResolvedValue([]);
    adapter.completeMultipart.mockResolvedValue(undefined);
  });

  it("rejects a missing batch, a foreign uid, and a non-admin caller", async () => {
    await seedAdmin();
    await expect(
      invoke({ batchId: "missing", metadata: METADATA })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await seedBatch(videoBatch({ uid: "other" }));
    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await fakeDb.ref("mediaUploads/batch-1").set(videoBatch());
    await fakeDb.ref("users/user-1/roles").set({ user: true });
    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA }, "user-1")
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects a batch that is already finalizing", async () => {
    await seedAdmin();
    await seedBatch(videoBatch({ status: "finalizing" }));

    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Finalize already in progress.",
    });
  });

  it("lets exactly one of two concurrent finalizes claim the batch", async () => {
    await seedAdmin();
    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });

    const results = await Promise.allSettled([
      invoke({ batchId: "batch-1", metadata: METADATA }),
      invoke({ batchId: "batch-1", metadata: METADATA }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "failed-precondition",
      message: "Finalize already in progress.",
    });
    expect(Object.keys(mediaRecords())).toHaveLength(1);
  });

  it("returns the existing record for a finalized batch without writing", async () => {
    await seedAdmin();
    await seedBatch(videoBatch({ status: "finalized", resultId: "rec-1" }));
    await fakeDb.ref("media/rec-1").set({ id: "rec-1", title: "Existing" });

    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).resolves.toEqual({ id: "rec-1", record: { id: "rec-1", title: "Existing" } });
    expect(adapter.head).not.toHaveBeenCalled();
  });

  it("retries a finalized batch with a null resultId", async () => {
    await seedAdmin();
    await seedBatch(videoBatch({ status: "finalized", resultId: null }));
    headFor({
      [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });

    const result = (await invoke({
      batchId: "batch-1",
      metadata: METADATA,
    })) as { id: string };
    expect(mediaRecords()[result.id]).toBeTruthy();
    expect(fakeDb.read("mediaUploads/batch-1/status")).toBe("finalized");
    expect(fakeDb.read("mediaUploads/batch-1/resultId")).toBe(result.id);
  });

  it("accepts 3:45 and rejects an empty title or bad duration", async () => {
    await seedAdmin();
    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });

    const result = (await invoke({ batchId: "batch-1", metadata: METADATA })) as {
      record: { duration: string };
    };
    expect(result.record.duration).toBe("3:45");

    await seedBatch(videoBatch());
    await expect(
      invoke({ batchId: "batch-1", metadata: { ...METADATA, title: "  " } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await seedBatch(videoBatch());
    await expect(
      invoke({ batchId: "batch-1", metadata: { ...METADATA, duration: "130" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("requires one track title per album track", async () => {
    await seedAdmin();
    await seedBatch(albumBatch());
    headFor({
      "Music/Albums/Le+Cours/01+First.mp3": { size: 100, contentType: "audio/mpeg" },
      "Music/Albums/Le+Cours/02+Second.mp3": { size: 200, contentType: "audio/mpeg" },
      "Music/Albums/Covers/Le+Cours.jpg": { size: 50, contentType: "image/jpeg" },
      "Music/Albums/Zips/Le+Cours.zip": { size: 300, contentType: "application/zip" },
    });

    await expect(
      invoke({
        batchId: "batch-1",
        metadata: { title: "Album", date: "2026" },
        trackTitles: ["Only One"],
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects a missing, wrong-size, wrong-type, or foreign single object", async () => {
    await seedAdmin();
    await seedBatch(videoBatch());

    adapter.head.mockResolvedValue({ exists: false });
    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: `Upload not found or invalid for "${VIDEO_KEY}". Upload the file again.`,
    });

    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 999, contentType: "video/mp4" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });
    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(adapter.deleteMany).not.toHaveBeenCalled();

    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 1000, contentType: "text/plain" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });
    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(adapter.deleteMany).not.toHaveBeenCalled();

    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 1000, contentType: "video/mp4", batchId: "other" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });
    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(adapter.deleteMany).toHaveBeenCalledWith([VIDEO_KEY]);

    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 2000, contentType: "video/mp4" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });
    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(adapter.deleteMany).toHaveBeenCalledWith([VIDEO_KEY]);
  });

  it("rejects a missing part, wrong part size, and wrong etag", async () => {
    await seedAdmin();
    const size = MULTIPART_PART_BYTES + 10;
    const multipart = () =>
      videoBatch({
        assets: [
          asset("video", VIDEO_KEY, size, "video/mp4", {
            multipart: true,
            uploadId: "upload-1",
          }),
        ],
      });

    await seedBatch(multipart());
    await expect(
      invoke({
        batchId: "batch-1",
        metadata: METADATA,
        parts: [{ role: "video", partNumber: 1, etag: '"a"' }],
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await seedBatch(multipart());
    adapter.listParts.mockResolvedValue([
      { partNumber: 1, size: MULTIPART_PART_BYTES - 1, etag: '"a"' },
      { partNumber: 2, size: 10, etag: '"b"' },
    ]);
    await expect(
      invoke({
        batchId: "batch-1",
        metadata: METADATA,
        parts: [
          { role: "video", partNumber: 1, etag: '"a"' },
          { role: "video", partNumber: 2, etag: '"b"' },
        ],
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await seedBatch(multipart());
    adapter.listParts.mockResolvedValue([
      { partNumber: 1, size: MULTIPART_PART_BYTES, etag: '"a"' },
      { partNumber: 2, size: 10, etag: '"b"' },
    ]);
    await expect(
      invoke({
        batchId: "batch-1",
        metadata: METADATA,
        parts: [
          { role: "video", partNumber: 1, etag: '"wrong"' },
          { role: "video", partNumber: 2, etag: '"b"' },
        ],
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("completes a verified multipart upload", async () => {
    await seedAdmin();
    const size = MULTIPART_PART_BYTES + 10;
    await seedBatch(
      videoBatch({
        assets: [
          asset("video", VIDEO_KEY, size, "video/mp4", {
            multipart: true,
            uploadId: "upload-1",
          }),
        ],
      })
    );
    adapter.listParts.mockResolvedValue([
      { partNumber: 1, size: MULTIPART_PART_BYTES, etag: '"a"' },
      { partNumber: 2, size: 10, etag: '"b"' },
    ]);
    headFor({ [VIDEO_KEY]: { size, contentType: "video/mp4" } });

    const result = (await invoke({
      batchId: "batch-1",
      metadata: METADATA,
      parts: [
        { role: "video", partNumber: 1, etag: '"a"' },
        { role: "video", partNumber: 2, etag: '"b"' },
      ],
    })) as { id: string };
    expect(adapter.completeMultipart).toHaveBeenCalledWith({
      key: VIDEO_KEY,
      uploadId: "upload-1",
      parts: [
        { partNumber: 1, etag: '"a"' },
        { partNumber: 2, etag: '"b"' },
      ],
    });
    expect(mediaRecords()[result.id]).toBeTruthy();
  });

  it("writes a video record with derived URLs and no uploader field", async () => {
    await seedAdmin();
    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });

    const result = (await invoke({
      batchId: "batch-1",
      metadata: METADATA,
    })) as { id: string; record: any };

    expect(result.record).toMatchObject({
      id: result.id,
      title: "My Clip",
      artist: "",
      date: "2026",
      fileName: "clip.mp4",
      folderName: "",
      urls: {
        download: "https://assets.lecoursville.com/Video/clip.mp4",
        icon: "https://assets.lecoursville.com/Video/Icons/clip.jpg",
      },
      type: "video",
      format: "video/mp4",
      duration: "3:45",
      isSticky: false,
      isHidden: false,
      listing: [],
      storage: {
        managed: true,
        key: VIDEO_KEY,
        iconKey: ICON_KEY,
        bytes: 1000,
        contentType: "video/mp4",
        batchId: "batch-1",
      },
    });
    expect(result.record.storage.uploadedByHash).toBeUndefined();
    expect(result.record.uploadedBy).toBeUndefined();
    expect(fakeDb.read("mediaUploads/batch-1/status")).toBe("finalized");
    expect(fakeDb.read("mediaUploads/batch-1/resultId")).toBe(result.id);
    expect(typeof fakeDb.read("mediaUploads/batch-1/finalizedAt")).toBe("number");
    expect(adapter.invalidate).not.toHaveBeenCalled();
  });

  it("writes an album plus tracks atomically with order and albumId stamps", async () => {
    await seedAdmin();
    await seedBatch(albumBatch());
    headFor({
      "Music/Albums/Le+Cours/01+First.mp3": { size: 100, contentType: "audio/mpeg" },
      "Music/Albums/Le+Cours/02+Second.mp3": { size: 200, contentType: "audio/mpeg" },
      "Music/Albums/Covers/Le+Cours.jpg": { size: 50, contentType: "image/jpeg" },
      "Music/Albums/Zips/Le+Cours.zip": { size: 300, contentType: "application/zip" },
    });

    const result = (await invoke({
      batchId: "batch-1",
      metadata: { title: "Album", date: "2026" },
      trackTitles: ["First Song", "Second Song"],
    })) as { id: string; record: any };

    expect(result.record).toMatchObject({
      id: result.id,
      title: "Album",
      folderName: "Le+Cours",
      type: "audio-album",
      format: "collection/audio",
      urls: {
        download: "https://assets.lecoursville.com/Music/Albums/Zips/Le+Cours.zip",
        icon: "https://assets.lecoursville.com/Music/Albums/Covers/Le+Cours.jpg",
      },
      storage: {
        managed: true,
        folder: "Music/Albums/Le+Cours",
        coverKey: "Music/Albums/Covers/Le+Cours.jpg",
        zipKey: "Music/Albums/Zips/Le+Cours.zip",
        trackKeys: [
          "Music/Albums/Le+Cours/01+First.mp3",
          "Music/Albums/Le+Cours/02+Second.mp3",
        ],
        batchId: "batch-1",
      },
    });
    expect(result.record.listing).toHaveLength(2);

    const records = mediaRecords();
    expect(Object.keys(records)).toHaveLength(3);
    const tracks = result.record.listing.map(
      (id: string) => records[id]
    ) as any[];
    expect(tracks.map((track) => track.title)).toEqual([
      "First Song",
      "Second Song",
    ]);
    expect(tracks.map((track) => track.fileName)).toEqual([
      "01+First.mp3",
      "02+Second.mp3",
    ]);
    expect(tracks.every((track) => track.storage.albumId === result.id)).toBe(true);
    expect(
      tracks.every(
        (track) =>
          track.urls.icon ===
          "https://assets.lecoursville.com/Music/Albums/Covers/Le+Cours.jpg"
      )
    ).toBe(true);
    expect(tracks.map((track) => track.storage.key)).toEqual(
      result.record.storage.trackKeys
    );
  });

  it("does not duplicate records on a repeated finalize", async () => {
    await seedAdmin();
    await seedBatch(videoBatch());
    headFor({
      [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" },
      [ICON_KEY]: { size: 500, contentType: "image/jpeg" },
    });

    const first = (await invoke({
      batchId: "batch-1",
      metadata: METADATA,
    })) as { id: string };
    const second = (await invoke({
      batchId: "batch-1",
      metadata: METADATA,
    })) as { id: string };

    expect(second.id).toBe(first.id);
    expect(Object.keys(mediaRecords())).toHaveLength(1);
  });

  it("reuses the existing icon on replace and invalidates exactly both paths", async () => {
    await seedAdmin();
    await fakeDb.ref("media/rec-1").set({
      id: "rec-1",
      type: "video",
      storage: {
        managed: true,
        key: VIDEO_KEY,
        iconKey: ICON_KEY,
      },
    });
    await seedBatch(
      videoBatch({
        mode: "replace",
        mediaId: "rec-1",
        assets: [asset("video", VIDEO_KEY, 1000, "video/mp4")],
      })
    );
    headFor({ [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" } });

    const result = (await invoke({
      batchId: "batch-1",
      metadata: { ...METADATA, title: "Replaced" },
    })) as { id: string; record: any };

    expect(result.id).toBe("rec-1");
    expect(result.record.storage.iconKey).toBe(ICON_KEY);
    expect(result.record.storage.batchId).toBe("batch-1");
    expect(adapter.invalidate).toHaveBeenCalledTimes(1);
    expect(adapter.invalidate).toHaveBeenCalledWith([VIDEO_KEY, ICON_KEY]);
    expect(adapter.head).toHaveBeenCalledWith(VIDEO_KEY);
    expect(adapter.head).not.toHaveBeenCalledWith(ICON_KEY);
  });

  it("fails when the record disappeared before finalize", async () => {
    await seedAdmin();
    await seedBatch(
      videoBatch({
        mode: "replace",
        mediaId: "gone",
        assets: [asset("video", VIDEO_KEY, 1000, "video/mp4")],
      })
    );
    headFor({ [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" } });

    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("logs an invalidation failure but keeps the record", async () => {
    await seedAdmin();
    await fakeDb.ref("media/rec-1").set({
      id: "rec-1",
      type: "video",
      storage: { managed: true, key: VIDEO_KEY, iconKey: ICON_KEY },
    });
    await seedBatch(
      videoBatch({
        mode: "replace",
        mediaId: "rec-1",
        assets: [asset("video", VIDEO_KEY, 1000, "video/mp4")],
      })
    );
    headFor({ [VIDEO_KEY]: { size: 1000, contentType: "video/mp4" } });
    adapter.invalidate.mockRejectedValue(new Error("invalidate failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      invoke({ batchId: "batch-1", metadata: METADATA })
    ).resolves.toMatchObject({ id: "rec-1" });
    expect(errorSpy).toHaveBeenCalled();
    expect(mediaRecords()["rec-1"]).toBeTruthy();
    errorSpy.mockRestore();
  });
});
