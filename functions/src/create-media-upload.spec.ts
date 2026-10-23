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

import { createMediaUpload } from "./create-media-upload";
import {
  MAX_TRACKS_PER_ALBUM,
  MAX_TRACK_BYTES,
  MULTIPART_THRESHOLD_BYTES,
} from "./media/config";
import { videoIconKey, videoKey } from "./media/naming";
import { getStorageAdapter } from "./media/storage-adapter";
import { fakeDb, FakeRef, resetFakeState } from "./test-support";

interface AdapterMock {
  head: ReturnType<typeof vi.fn>;
  createMultipart: ReturnType<typeof vi.fn>;
}

const adapter = getStorageAdapter() as unknown as AdapterMock;

async function seedAdmin(
  uid = "admin-1",
  roles: { admin?: boolean; super?: boolean } = { admin: true }
): Promise<void> {
  await fakeDb.ref(`users/${uid}/roles`).set({ user: true, ...roles });
}

function invoke(data: Record<string, unknown>, uid: string | null = "admin-1") {
  return createMediaUpload.run({
    data,
    auth: uid ? { uid, token: {} } : null,
    rawRequest: {},
  } as never);
}

function videoData(overrides: Record<string, unknown> = {}) {
  return {
    kind: "video",
    mode: "create",
    video: {
      storageName: "my-video",
      sourceFileName: "My Video.mp4",
      size: 1000,
      contentType: "video/mp4",
      thumbnail: {
        sourceFileName: "thumb.jpg",
        size: 500,
        contentType: "image/jpeg",
      },
      ...overrides,
    },
  };
}

function albumData(trackCount = 2, overrides: Record<string, unknown> = {}) {
  return {
    kind: "audio-album",
    mode: "create",
    album: {
      folderName: "Le Cours",
      cover: { size: 1000, contentType: "image/jpeg" },
      zip: { size: 2000, contentType: "application/zip" },
      tracks: Array.from({ length: trackCount }, (_, index) => ({
        sourceFileName: `track-${index}.mp3`,
        title: `Track ${index}`,
        size: 1000,
        contentType: "audio/mpeg",
      })),
      ...overrides,
    },
  };
}

function batchIds(): string[] {
  return Object.keys((fakeDb.read("mediaUploads") as object) ?? {});
}

describe("createMediaUpload", () => {
  beforeEach(() => {
    resetFakeState();
    vi.clearAllMocks();
    process.env.EMAIL_DRY_RUN = "1";
    adapter.head.mockResolvedValue({ exists: false });
    let uploadSeq = 0;
    adapter.createMultipart.mockImplementation(async () => ({
      uploadId: `upload-${++uploadSeq}`,
    }));
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(invoke(videoData(), null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects a user without an admin or super role", async () => {
    await seedAdmin("user-1", { admin: false, super: false });

    await expect(invoke(videoData(), "user-1")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("accepts an admin and a super caller", async () => {
    await seedAdmin("admin-1", { admin: true });
    await seedAdmin("super-1", { admin: false, super: true });

    await expect(invoke(videoData())).resolves.toMatchObject({
      batchId: expect.any(String),
    });
    await expect(
      invoke(videoData({ storageName: "other" }), "super-1")
    ).resolves.toMatchObject({ batchId: expect.any(String) });
  });

  it("rejects the 21st create in an hour for one uid", async () => {
    await seedAdmin();
    for (let index = 0; index < 20; index++) {
      await invoke(videoData({ storageName: `clip-${index}` }));
    }
    const before = batchIds().length;

    await expect(
      invoke(videoData({ storageName: "clip-20" }))
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(batchIds()).toHaveLength(before);
  });

  it("rejects an unknown kind, mode, content type, and size", async () => {
    await seedAdmin();
    const invalid: Array<Record<string, unknown>> = [
      { ...videoData(), kind: "photo" },
      { ...videoData(), mode: "update" },
      videoData({ contentType: "image/png" }),
      videoData({ size: 0 }),
      videoData({ size: -1 }),
      videoData({ size: 1.5 }),
    ];
    for (const data of invalid) {
      await expect(invoke(data)).rejects.toMatchObject({
        code: "invalid-argument",
      });
    }
    expect(batchIds()).toHaveLength(0);
  });

  it("rejects invalid video, folder, and track names including URL metacharacters", async () => {
    await seedAdmin();
    for (const storageName of ["Bad Name", "bad%name", "bad?name", "bad#name", "bad&name"]) {
      await expect(
        invoke(videoData({ storageName }))
      ).rejects.toMatchObject({ code: "invalid-argument" });
    }
    for (const folderName of ["bad/folder", "bad%folder", "bad?folder", "bad#folder", "bad&folder"]) {
      await expect(
        invoke(albumData(1, { folderName }))
      ).rejects.toMatchObject({ code: "invalid-argument" });
    }
    const badTrack = albumData(1);
    (badTrack.album as Record<string, unknown>).tracks = [
      { sourceFileName: "bad?track.mp3", title: "Bad", size: 10, contentType: "audio/mpeg" },
    ];
    await expect(invoke(badTrack)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects duplicate track file names with the documented message", async () => {
    await seedAdmin();
    const data = albumData(2);
    (data.album as Record<string, unknown>).tracks = [
      { sourceFileName: "same.mp3", title: "One", size: 10, contentType: "audio/mpeg" },
      { sourceFileName: "same.mp3", title: "Two", size: 10, contentType: "audio/mpeg" },
    ];

    await expect(invoke(data)).rejects.toMatchObject({
      code: "invalid-argument",
      message:
        'Two tracks use the same file name: "same.mp3". Rename one track file before uploading.',
    });
  });

  it("accepts one hundred tracks and rejects one hundred and one", async () => {
    await seedAdmin();

    await expect(invoke(albumData(MAX_TRACKS_PER_ALBUM))).resolves.toMatchObject({
      batchId: expect.any(String),
    });
    await expect(
      invoke(albumData(MAX_TRACKS_PER_ALBUM + 1, { folderName: "Too Many" }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects an over-cap album track total", async () => {
    await seedAdmin();
    const data = albumData(11);
    (data.album as Record<string, unknown>).tracks = Array.from(
      { length: 11 },
      (_, index) => ({
        sourceFileName: `track-${index}.mp3`,
        title: `Track ${index}`,
        size: MAX_TRACK_BYTES,
        contentType: "audio/mpeg",
      })
    );

    await expect(invoke(data)).rejects.toMatchObject({
      code: "invalid-argument",
      message: "Album tracks must total 2000000000 bytes or less.",
    });
  });

  it("distinguishes a record duplicate from an orphan object", async () => {
    await seedAdmin();
    await fakeDb.ref("media/dup").set({ fileName: "dup.mp4" });

    await expect(invoke(videoData({ storageName: "dup" }))).rejects.toMatchObject({
      code: "already-exists",
      message:
        'A record named "Video/dup.mp4" already exists. Delete it or choose a different name.',
    });

    adapter.head.mockResolvedValueOnce({ exists: true });
    await expect(
      invoke(videoData({ storageName: "orphan" }))
    ).rejects.toMatchObject({
      code: "already-exists",
      message:
        'An orphan file named "Video/orphan.mp4" exists. Choose a different name; the storage sweep will remove it later.',
    });
  });

  it("reports the record duplicate when both the record and its object exist", async () => {
    await seedAdmin();
    await fakeDb.ref("media/dup-both").set({ fileName: "dup-both.mp4" });
    adapter.head.mockResolvedValue({ exists: true });

    await expect(
      invoke(videoData({ storageName: "dup-both" }))
    ).rejects.toMatchObject({
      code: "already-exists",
      message:
        'A record named "Video/dup-both.mp4" already exists. Delete it or choose a different name.',
    });
  });

  it("requires a managed video record to replace and reuses the icon without a thumbnail", async () => {
    await seedAdmin();
    const storageName = "replace-me";
    await fakeDb.ref("media/rec-1").set({
      id: "rec-1",
      type: "video",
      storage: {
        managed: true,
        key: videoKey(storageName),
        iconKey: videoIconKey(storageName),
      },
    });
    const data = videoData({ storageName, thumbnail: undefined });
    data.mode = "replace";
    (data as Record<string, unknown>).mediaId = "rec-1";

    const result = (await invoke(data)) as {
      batchId: string;
      keys: { video: { key: string; iconKey: string } };
      firstAsset: { role: string };
    };
    expect(result.keys.video).toEqual({
      key: videoKey(storageName),
      iconKey: videoIconKey(storageName),
    });
    const batch = fakeDb.read(`mediaUploads/${result.batchId}`) as {
      mode: string;
      mediaId: string;
      assets: Array<{ role: string }>;
    };
    expect(batch.mode).toBe("replace");
    expect(batch.mediaId).toBe("rec-1");
    expect(batch.assets.map((asset) => asset.role)).toEqual(["video"]);

    await expect(invoke({ ...data, mediaId: "missing" })).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rejects key mismatches on replace", async () => {
    await seedAdmin();
    await fakeDb.ref("media/rec-1").set({
      id: "rec-1",
      type: "video",
      storage: { managed: true, key: "Video/other.mp4", iconKey: "Video/Icons/other.jpg" },
    });
    const data = videoData({ storageName: "replace-me", thumbnail: undefined });
    data.mode = "replace";
    (data as Record<string, unknown>).mediaId = "rec-1";

    await expect(invoke(data)).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rejects album replacement with the documented message", async () => {
    await seedAdmin();
    const data = albumData(1);
    data.mode = "replace";

    await expect(invoke(data)).rejects.toMatchObject({
      code: "failed-precondition",
      message:
        "Album content cannot be replaced. Delete the album and upload it again.",
    });
  });

  it("requires a thumbnail when creating a video but not when replacing", async () => {
    await seedAdmin();

    await expect(
      invoke(videoData({ thumbnail: undefined }))
    ).rejects.toMatchObject({
      code: "invalid-argument",
      message: "A thumbnail is required when creating a video.",
    });
    expect(batchIds()).toHaveLength(0);

    await fakeDb.ref("media/rec-1").set({
      id: "rec-1",
      type: "video",
      storage: {
        managed: true,
        key: videoKey("my-video"),
        iconKey: videoIconKey("my-video"),
      },
    });
    const replace = videoData({ thumbnail: undefined });
    replace.mode = "replace";
    (replace as Record<string, unknown>).mediaId = "rec-1";
    await expect(invoke(replace)).resolves.toMatchObject({
      batchId: expect.any(String),
    });
  });

  it("starts multipart only above the threshold and records the upload id", async () => {
    await seedAdmin();
    const data = videoData({
      size: MULTIPART_THRESHOLD_BYTES + 1,
    });

    const result = (await invoke(data)) as { batchId: string };
    expect(adapter.createMultipart).toHaveBeenCalledTimes(1);
    expect(adapter.createMultipart).toHaveBeenCalledWith({
      key: videoKey("my-video"),
      contentType: "video/mp4",
      batchId: result.batchId,
    });
    const batch = fakeDb.read(`mediaUploads/${result.batchId}`) as {
      assets: Array<{ multipart: boolean; uploadId: string | null }>;
    };
    expect(batch.assets[0]).toMatchObject({
      multipart: true,
      uploadId: "upload-1",
    });
  });

  it("keeps small assets on a single PUT", async () => {
    await seedAdmin();

    const result = (await invoke(videoData())) as { batchId: string };
    expect(adapter.createMultipart).not.toHaveBeenCalled();
    const batch = fakeDb.read(`mediaUploads/${result.batchId}`) as {
      assets: Array<{ multipart: boolean; uploadId: string | null }>;
    };
    expect(batch.assets.every((asset) => !asset.multipart && asset.uploadId === null)).toBe(true);
  });

  it("always uses a single PUT in emulator mode", async () => {
    await seedAdmin();
    process.env.FUNCTIONS_EMULATOR = "true";

    const result = (await invoke(
      videoData({ size: MULTIPART_THRESHOLD_BYTES + 1 })
    )) as { batchId: string };
    expect(adapter.createMultipart).not.toHaveBeenCalled();
    const batch = fakeDb.read(`mediaUploads/${result.batchId}`) as {
      assets: Array<{ multipart: boolean }>;
    };
    expect(batch.assets[0].multipart).toBe(false);
  });

  it("writes the batch ledger with derived keys, the real uid, and activity time", async () => {
    await seedAdmin();

    const result = (await invoke(albumData(2))) as {
      batchId: string;
      firstAsset: { role: string; trackIndex?: number };
    };
    const batch = fakeDb.read(`mediaUploads/${result.batchId}`) as Record<string, unknown> & {
      assets: Array<{ role: string; key: string }>;
    };

    expect(batch).toMatchObject({
      kind: "audio-album",
      mode: "create",
      mediaId: null,
      uid: "admin-1",
      status: "ticketed",
    });
    expect(typeof batch.lastActivityAt).toBe("number");
    expect(batch.assets.map((asset) => asset.key)).toEqual([
      "Music/Albums/Le+Cours/track-0.mp3",
      "Music/Albums/Le+Cours/track-1.mp3",
      "Music/Albums/Covers/Le+Cours.jpg",
      "Music/Albums/Zips/Le+Cours.zip",
    ]);
    expect(result.firstAsset).toEqual({ role: "track", trackIndex: 0 });
  });

  it("writes no batch when validation, HEAD, query, or multipart initiation fails", async () => {
    await seedAdmin();

    await expect(
      invoke(videoData({ storageName: "Bad Name" }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(batchIds()).toHaveLength(0);

    adapter.head.mockRejectedValueOnce(new Error("head failed"));
    await expect(invoke(videoData())).rejects.toThrow("head failed");
    expect(batchIds()).toHaveLength(0);

    const originalRef = fakeDb.ref.bind(fakeDb);
    const refSpy = vi.spyOn(fakeDb, "ref").mockImplementation(((path: string) => {
      if (path === "media") {
        return {
          orderByChild: () => ({
            equalTo: () => ({
              get: () => Promise.reject(new Error("query failed")),
            }),
          }),
        } as never;
      }
      return originalRef(path);
    }) as never);
    await expect(invoke(videoData())).rejects.toThrow("query failed");
    refSpy.mockRestore();
    expect(batchIds()).toHaveLength(0);

    adapter.createMultipart.mockRejectedValueOnce(new Error("multipart failed"));
    await expect(
      invoke(videoData({ size: MULTIPART_THRESHOLD_BYTES + 1 }))
    ).rejects.toThrow("multipart failed");
    expect(batchIds()).toHaveLength(0);
  });

  it("aborts initiated multipart uploads when the batch write fails", async () => {
    await seedAdmin();
    const originalSet = FakeRef.prototype.set;
    const setSpy = vi
      .spyOn(FakeRef.prototype, "set")
      .mockImplementation(async function (
        this: FakeRef,
        value: unknown
      ): Promise<void> {
        const path = (this as unknown as { path: string }).path;
        if (path.startsWith("mediaUploads/")) {
          throw new Error("batch write failed");
        }
        return originalSet.call(this, value);
      });

    await expect(
      invoke(videoData({ size: MULTIPART_THRESHOLD_BYTES + 1 }))
    ).rejects.toThrow("batch write failed");
    expect(adapter.abortMultipart).toHaveBeenCalledWith(
      videoKey("my-video"),
      "upload-1"
    );
    expect(batchIds()).toHaveLength(0);

    setSpy.mockRestore();
  });
});
