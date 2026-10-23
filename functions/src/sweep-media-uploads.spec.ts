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

import type { MediaDeletion } from "./delete-media";
import type { MediaBatchAsset, MediaUploadBatch } from "./media/batch";
import { SWEEP_GRACE_MS } from "./media/config";
import { getStorageAdapter } from "./media/storage-adapter";
import {
  sweepPendingDeletion,
  sweepUploadBatch,
} from "./sweep-media-uploads";
import { fakeDb, resetFakeState } from "./test-support";

interface AdapterMock {
  abortMultipart: ReturnType<typeof vi.fn>;
  head: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
}

const adapter = getStorageAdapter() as unknown as AdapterMock;

const KEY = "Video/clip.mp4";
const ICON_KEY = "Video/Icons/clip.jpg";

function asset(
  role: MediaBatchAsset["role"],
  key: string,
  extra: Partial<MediaBatchAsset> = {}
): MediaBatchAsset {
  return {
    role,
    key,
    contentType: "video/mp4",
    size: 1000,
    multipart: false,
    uploadId: null,
    parts: [],
    ...extra,
  };
}

function batch(overrides: Partial<MediaUploadBatch> = {}): MediaUploadBatch {
  return {
    kind: "video",
    mode: "create",
    mediaId: null,
    uid: "admin-1",
    createdAt: 1,
    lastActivityAt: 1,
    status: "ticketed",
    assets: [asset("video", KEY), asset("thumbnail", ICON_KEY)],
    resultId: null,
    finalizedAt: null,
    ...overrides,
  };
}

function deletion(overrides: Partial<MediaDeletion> = {}): MediaDeletion {
  return {
    deletionId: "vid-1",
    mediaIds: ["vid-1"],
    keys: [KEY, ICON_KEY],
    uid: "admin-1",
    createdAt: 1,
    status: "pending",
    failedKeys: [],
    ...overrides,
  };
}

describe("sweepMediaUploads", () => {
  beforeEach(() => {
    resetFakeState();
    vi.clearAllMocks();
    adapter.head.mockResolvedValue({ exists: false });
    adapter.deleteMany.mockImplementation(async (keys: string[]) => ({
      deleted: keys.length,
      warnings: [],
    }));
    adapter.abortMultipart.mockResolvedValue(undefined);
  });

  it("skips a batch newer than the grace window", async () => {
    const now = Date.now();
    const newer = batch({ lastActivityAt: now - SWEEP_GRACE_MS + 1000 });
    await fakeDb.ref("mediaUploads/batch-1").set(newer);

    await expect(sweepUploadBatch("batch-1", newer, now)).resolves.toEqual({
      action: "skipped",
      objectsDeleted: 0,
      multipartUploadsAborted: 0,
    });
    expect(adapter.deleteMany).not.toHaveBeenCalled();
    expect(fakeDb.read("mediaUploads/batch-1")).toMatchObject({
      status: "ticketed",
    });
  });

  it("deletes a stale ticketed batch's assets and aborts its multipart upload", async () => {
    const now = Date.now();
    const stale = batch({
      lastActivityAt: now - SWEEP_GRACE_MS - 1000,
      assets: [
        asset("video", KEY, {
          multipart: true,
          uploadId: "upload-1",
          contentType: "video/mp4",
        }),
        asset("thumbnail", ICON_KEY, { contentType: "image/jpeg" }),
      ],
    });
    await fakeDb.ref("mediaUploads/batch-1").set(stale);

    await expect(sweepUploadBatch("batch-1", stale, now)).resolves.toEqual({
      action: "removed",
      objectsDeleted: 2,
      multipartUploadsAborted: 1,
    });
    expect(adapter.deleteMany).toHaveBeenCalledWith([KEY, ICON_KEY]);
    expect(adapter.abortMultipart).toHaveBeenCalledWith(KEY, "upload-1");
    expect(fakeDb.read("mediaUploads/batch-1")).toBeNull();
  });

  it("marks a stale finalizing batch with a matching record finalized and keeps its objects", async () => {
    const now = Date.now();
    const stale = batch({
      status: "finalizing",
      lastActivityAt: now - SWEEP_GRACE_MS - 1000,
    });
    await fakeDb.ref("mediaUploads/batch-1").set(stale);
    await fakeDb.ref("media/rec-1").set({
      id: "rec-1",
      storage: { managed: true, key: KEY, batchId: "batch-1" },
    });

    await expect(sweepUploadBatch("batch-1", stale, now)).resolves.toEqual({
      action: "kept",
      objectsDeleted: 0,
      multipartUploadsAborted: 0,
    });
    expect(adapter.deleteMany).not.toHaveBeenCalled();
    expect(adapter.abortMultipart).not.toHaveBeenCalled();
    expect(fakeDb.read("mediaUploads/batch-1")).toMatchObject({
      status: "finalized",
      resultId: "rec-1",
    });
    expect(fakeDb.read("media/rec-1")).toBeTruthy();
  });

  it("retries a pending deletion and marks it completed once every object is gone", async () => {
    const pending = deletion();
    await fakeDb.ref("mediaDeletions/vid-1").set(pending);

    await expect(
      sweepPendingDeletion("vid-1", pending)
    ).resolves.toEqual({ objectsDeleted: 2, completed: true });
    expect(adapter.deleteMany).toHaveBeenCalledWith([KEY, ICON_KEY]);
    expect(adapter.head).toHaveBeenCalledWith(KEY);
    expect(adapter.head).toHaveBeenCalledWith(ICON_KEY);
    expect(fakeDb.read("mediaDeletions/vid-1")).toMatchObject({
      status: "completed",
      failedKeys: [],
    });
  });

  it("removes media records and rewrites the parent when completing a pending deletion", async () => {
    const pending = deletion({
      deletionId: "track-1",
      mediaIds: ["track-1"],
      keys: [KEY],
      parentId: "album-1",
      parentTrackKey: KEY,
    });
    await fakeDb.ref("media/track-1").set({
      id: "track-1",
      type: "audio-track",
    });
    await fakeDb.ref("media/album-1").set({
      id: "album-1",
      type: "audio-album",
      listing: ["track-1", "track-2"],
      storage: { trackKeys: [KEY, "Music/Albums/Le+Cours/02+Second.mp3"] },
    });
    await fakeDb.ref("mediaDeletions/track-1").set(pending);

    await expect(
      sweepPendingDeletion("track-1", pending)
    ).resolves.toEqual({ objectsDeleted: 1, completed: true });

    expect(fakeDb.read("media/track-1")).toBeNull();
    expect(fakeDb.read("media/album-1/listing")).toEqual(["track-2"]);
    expect(fakeDb.read("media/album-1/storage/trackKeys")).toEqual([
      "Music/Albums/Le+Cours/02+Second.mp3",
    ]);
    expect(fakeDb.read("mediaDeletions/track-1/status")).toBe("completed");
  });

  it("never touches objects that no swept batch references", async () => {
    const now = Date.now();
    const stale = batch({
      lastActivityAt: now - SWEEP_GRACE_MS - 1000,
      assets: [asset("video", KEY)],
    });
    const other = batch({
      lastActivityAt: now - SWEEP_GRACE_MS - 1000,
      assets: [asset("video", "Video/other.mp4")],
    });
    await fakeDb.ref("mediaUploads/batch-1").set(stale);
    await fakeDb.ref("mediaUploads/batch-2").set(other);

    await sweepUploadBatch("batch-1", stale, now);

    expect(adapter.deleteMany).toHaveBeenCalledTimes(1);
    expect(adapter.deleteMany).toHaveBeenCalledWith([KEY]);
    expect(fakeDb.read("mediaUploads/batch-2")).toBeTruthy();
  });
});
