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

import { deleteMedia } from "./delete-media";
import { getStorageAdapter } from "./media/storage-adapter";
import { FakeRef, fakeDb, resetFakeState } from "./test-support";

interface AdapterMock {
  abortMultipart: ReturnType<typeof vi.fn>;
  head: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  invalidate: ReturnType<typeof vi.fn>;
}

const adapter = getStorageAdapter() as unknown as AdapterMock;

const VIDEO_KEY = "Video/clip.mp4";
const ICON_KEY = "Video/Icons/clip.jpg";
const FOLDER = "Music/Albums/Le+Cours";
const TRACK_KEYS = [
  "Music/Albums/Le+Cours/01+First.mp3",
  "Music/Albums/Le+Cours/02+Second.mp3",
];
const COVER_KEY = "Music/Albums/Covers/Le+Cours.jpg";
const ZIP_KEY = "Music/Albums/Zips/Le+Cours.zip";

async function seedAdmin(uid = "admin-1"): Promise<void> {
  await fakeDb.ref(`users/${uid}/roles`).set({ user: true, admin: true });
}

function legacyVideo(): Record<string, unknown> {
  return {
    id: "vid-1",
    title: "Legacy",
    type: "video",
    format: "video/mp4",
    urls: { download: "https://drive.google.com/file", icon: "icon" },
  };
}

function managedVideo(): Record<string, unknown> {
  return {
    id: "vid-1",
    title: "Managed",
    type: "video",
    format: "video/mp4",
    urls: {
      download: "https://assets.lecoursville.com/Video/clip.mp4",
      icon: "https://assets.lecoursville.com/Video/Icons/clip.jpg",
    },
    storage: {
      managed: true,
      key: VIDEO_KEY,
      iconKey: ICON_KEY,
      bytes: 1000,
      contentType: "video/mp4",
      batchId: "batch-1",
    },
  };
}

function managedAlbum(): Record<string, unknown> {
  return {
    id: "album-1",
    title: "Album",
    type: "audio-album",
    format: "collection/audio",
    listing: ["track-1", "track-2"],
    urls: { download: "zip", icon: "icon" },
    storage: {
      managed: true,
      folder: FOLDER,
      coverKey: COVER_KEY,
      zipKey: ZIP_KEY,
      trackKeys: TRACK_KEYS,
      batchId: "batch-1",
    },
  };
}

function managedTrack(id: string, key: string): Record<string, unknown> {
  return {
    id,
    title: id,
    type: "audio-track",
    format: "audio/mpeg",
    urls: { download: "track", icon: "icon" },
    storage: {
      managed: true,
      key,
      albumId: "album-1",
      bytes: 10,
      contentType: "audio/mpeg",
      batchId: "batch-1",
    },
  };
}

function invoke(data: Record<string, unknown>, uid: string | null = "admin-1") {
  return deleteMedia.run({
    data,
    auth: uid ? { uid, token: {} } : null,
    rawRequest: {},
  } as never);
}

describe("deleteMedia", () => {
  beforeEach(() => {
    resetFakeState();
    vi.clearAllMocks();
    process.env.EMAIL_DRY_RUN = "1";
    adapter.head.mockResolvedValue({ exists: false });
    adapter.deleteMany.mockImplementation(async (keys: string[]) => ({
      deleted: keys.length,
      warnings: [],
    }));
    adapter.abortMultipart.mockResolvedValue(undefined);
    adapter.invalidate.mockResolvedValue(undefined);
  });

  it("removes a legacy record without any S3 calls", async () => {
    await seedAdmin();
    await fakeDb.ref("media/vid-1").set(legacyVideo());

    await expect(invoke({ mediaId: "vid-1" })).resolves.toEqual({
      id: "vid-1",
      objectsDeleted: 0,
      warnings: [],
    });
    expect(fakeDb.read("media/vid-1")).toBeNull();
    expect(adapter.head).not.toHaveBeenCalled();
    expect(adapter.deleteMany).not.toHaveBeenCalled();
    expect(adapter.invalidate).not.toHaveBeenCalled();
    expect(fakeDb.read("mediaDeletions/vid-1")).toBeNull();
  });

  it("deletes and verifies a managed video's objects, records, and invalidation", async () => {
    await seedAdmin();
    await fakeDb.ref("media/vid-1").set(managedVideo());

    await expect(invoke({ mediaId: "vid-1" })).resolves.toMatchObject({
      id: "vid-1",
      objectsDeleted: 2,
      warnings: [],
    });
    expect(adapter.deleteMany).toHaveBeenCalledWith([VIDEO_KEY, ICON_KEY]);
    expect(adapter.head).toHaveBeenCalledWith(VIDEO_KEY);
    expect(adapter.head).toHaveBeenCalledWith(ICON_KEY);
    expect(fakeDb.read("media/vid-1")).toBeNull();
    expect(adapter.invalidate).toHaveBeenCalledWith([
      `/${VIDEO_KEY}`,
      `/${ICON_KEY}`,
    ]);
    expect(fakeDb.read("mediaDeletions/vid-1")).toMatchObject({
      deletionId: "vid-1",
      mediaIds: ["vid-1"],
      keys: [VIDEO_KEY, ICON_KEY],
      uid: "admin-1",
      status: "completed",
      failedKeys: [],
    });
  });

  it("deletes a managed album cascade and uses three wildcard paths", async () => {
    await seedAdmin();
    await fakeDb.ref("media/album-1").set(managedAlbum());
    await fakeDb.ref("media/track-1").set(managedTrack("track-1", TRACK_KEYS[0]));
    await fakeDb.ref("media/track-2").set(managedTrack("track-2", TRACK_KEYS[1]));

    await expect(invoke({ mediaId: "album-1" })).resolves.toMatchObject({
      id: "album-1",
      objectsDeleted: 4,
      warnings: [],
    });
    expect(adapter.deleteMany).toHaveBeenCalledWith([
      TRACK_KEYS[0],
      TRACK_KEYS[1],
      COVER_KEY,
      ZIP_KEY,
    ]);
    expect(fakeDb.read("media/album-1")).toBeNull();
    expect(fakeDb.read("media/track-1")).toBeNull();
    expect(fakeDb.read("media/track-2")).toBeNull();
    expect(adapter.invalidate).toHaveBeenCalledWith([
      `/${FOLDER}/*`,
      `/${COVER_KEY}`,
      `/${ZIP_KEY}`,
    ]);
  });

  it("rewrites the parent album listing and track keys when deleting a track", async () => {
    await seedAdmin();
    await fakeDb.ref("media/album-1").set(managedAlbum());
    await fakeDb.ref("media/track-1").set(managedTrack("track-1", TRACK_KEYS[0]));
    await fakeDb.ref("media/track-2").set(managedTrack("track-2", TRACK_KEYS[1]));

    await expect(invoke({ mediaId: "track-1" })).resolves.toMatchObject({
      id: "track-1",
      objectsDeleted: 1,
    });
    expect(adapter.deleteMany).toHaveBeenCalledWith([TRACK_KEYS[0]]);
    expect(fakeDb.read("media/track-1")).toBeNull();
    expect(fakeDb.read("media/album-1/listing")).toEqual(["track-2"]);
    expect(fakeDb.read("media/album-1/storage/trackKeys")).toEqual([
      TRACK_KEYS[1],
    ]);
    expect(fakeDb.read("mediaDeletions/track-1")).toMatchObject({
      mediaIds: ["track-1"],
      status: "completed",
    });
  });

  it("aborts before touching records when an object remains", async () => {
    await seedAdmin();
    await fakeDb.ref("media/vid-1").set(managedVideo());
    adapter.head.mockImplementation(async (key: string) => ({
      exists: key === VIDEO_KEY,
    }));

    await expect(invoke({ mediaId: "vid-1" })).rejects.toMatchObject({
      code: "failed-precondition",
      message: `Could not delete "${VIDEO_KEY}". Retry the delete.`,
    });
    expect(fakeDb.read("media/vid-1")).toBeTruthy();
    expect(fakeDb.read("mediaDeletions/vid-1")).toBeNull();
    expect(adapter.invalidate).not.toHaveBeenCalled();
  });

  it("leaves a pending deletion entry when record removal fails and completes on retry", async () => {
    await seedAdmin();
    await fakeDb.ref("media/vid-1").set(managedVideo());
    const updateSpy = vi
      .spyOn(FakeRef.prototype, "update")
      .mockRejectedValueOnce(new Error("database unavailable"));
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const first = (await invoke({ mediaId: "vid-1" })) as {
      warnings: string[];
      objectsDeleted: number;
    };
    expect(first.objectsDeleted).toBe(2);
    expect(first.warnings).toHaveLength(1);
    expect(fakeDb.read("media/vid-1")).toBeTruthy();
    expect(fakeDb.read("mediaDeletions/vid-1/status")).toBe("pending");

    await expect(invoke({ mediaId: "vid-1" })).resolves.toMatchObject({
      id: "vid-1",
      warnings: [],
    });
    expect(fakeDb.read("media/vid-1")).toBeNull();
    expect(fakeDb.read("mediaDeletions/vid-1/status")).toBe("completed");

    updateSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("resumes a pending deletion when the media record is already gone", async () => {
    await seedAdmin();
    await fakeDb.ref("mediaDeletions/vid-1").set({
      deletionId: "vid-1",
      mediaIds: ["vid-1"],
      keys: [VIDEO_KEY, ICON_KEY],
      uid: "admin-1",
      createdAt: 1,
      status: "pending",
      failedKeys: [],
    });

    await expect(invoke({ mediaId: "vid-1" })).resolves.toMatchObject({
      id: "vid-1",
      objectsDeleted: 2,
      warnings: [],
    });
    expect(adapter.deleteMany).toHaveBeenCalledWith([VIDEO_KEY, ICON_KEY]);
    expect(adapter.invalidate).toHaveBeenCalledWith([
      `/${VIDEO_KEY}`,
      `/${ICON_KEY}`,
    ]);
    expect(fakeDb.read("mediaDeletions/vid-1/status")).toBe("completed");
  });

  it("cancels a batch by deleting its assets and aborting multipart uploads", async () => {
    await seedAdmin();
    await fakeDb.ref("media/keep-1").set(legacyVideo());
    await fakeDb.ref("mediaUploads/batch-1").set({
      kind: "video",
      mode: "create",
      mediaId: null,
      uid: "admin-1",
      createdAt: 1,
      lastActivityAt: 1,
      status: "ticketed",
      assets: [
        {
          role: "video",
          key: VIDEO_KEY,
          contentType: "video/mp4",
          size: 1000,
          multipart: true,
          uploadId: "upload-1",
          parts: [],
        },
        {
          role: "thumbnail",
          key: ICON_KEY,
          contentType: "image/jpeg",
          size: 10,
          multipart: false,
          uploadId: null,
          parts: [],
        },
      ],
      resultId: null,
      finalizedAt: null,
    });

    await expect(invoke({ batchId: "batch-1" })).resolves.toEqual({
      batchId: "batch-1",
      objectsDeleted: 2,
    });
    expect(adapter.deleteMany).toHaveBeenCalledWith([VIDEO_KEY, ICON_KEY]);
    expect(adapter.abortMultipart).toHaveBeenCalledWith(
      VIDEO_KEY,
      "upload-1"
    );
    expect(adapter.abortMultipart).toHaveBeenCalledTimes(1);
    expect(fakeDb.read("mediaUploads/batch-1")).toBeNull();
    expect(fakeDb.read("media/keep-1")).toBeTruthy();

    await fakeDb.ref("mediaUploads/batch-2").set({
      uid: "other",
      assets: [],
      status: "ticketed",
    });
    await expect(invoke({ batchId: "batch-2" })).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rejects a non-admin caller and applies the rate limit", async () => {
    await fakeDb.ref("users/user-1/roles").set({ user: true });
    await fakeDb.ref("media/vid-1").set(legacyVideo());
    await expect(invoke({ mediaId: "vid-1" }, "user-1")).rejects.toMatchObject({
      code: "permission-denied",
    });

    await seedAdmin();
    await fakeDb.ref("rateLimits/media-delete/admin-1").set({
      windowStart: Date.now(),
      count: 60,
      previous: 0,
    });
    await expect(invoke({ mediaId: "vid-1" })).rejects.toMatchObject({
      code: "resource-exhausted",
    });
    expect(fakeDb.read("media/vid-1")).toBeTruthy();
  });

  it("requires exactly one of mediaId or batchId", async () => {
    await seedAdmin();

    await expect(invoke({})).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(
      invoke({ mediaId: "vid-1", batchId: "batch-1" })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});
