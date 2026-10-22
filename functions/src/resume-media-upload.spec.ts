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

import type { MediaUploadBatch } from "./media/batch";
import {
  MULTIPART_PART_BYTES,
  TICKET_TTL_SECONDS,
} from "./media/config";
import { videoKey } from "./media/naming";
import { getStorageAdapter } from "./media/storage-adapter";
import { resumeMediaUpload } from "./resume-media-upload";
import { fakeDb, resetFakeState } from "./test-support";

interface AdapterMock {
  presignPut: ReturnType<typeof vi.fn>;
  presignParts: ReturnType<typeof vi.fn>;
  head: ReturnType<typeof vi.fn>;
}

const adapter = getStorageAdapter() as unknown as AdapterMock;

async function seedAdmin(uid = "admin-1"): Promise<void> {
  await fakeDb.ref(`users/${uid}/roles`).set({ user: true, admin: true });
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
    assets: [
      {
        role: "video",
        key: videoKey("clip"),
        contentType: "video/mp4",
        size: 1000,
        multipart: false,
        uploadId: null,
        parts: [],
      },
    ],
    resultId: null,
    finalizedAt: null,
    ...overrides,
  };
}

async function seedBatch(value: MediaUploadBatch, id = "batch-1"): Promise<void> {
  await fakeDb.ref(`mediaUploads/${id}`).set(value);
}

function invoke(data: Record<string, unknown>, uid: string | null = "admin-1") {
  return resumeMediaUpload.run({
    data,
    auth: uid ? { uid, token: {} } : null,
    rawRequest: {},
  } as never);
}

describe("resumeMediaUpload", () => {
  beforeEach(() => {
    resetFakeState();
    vi.clearAllMocks();
    adapter.head.mockResolvedValue({ exists: false });
    adapter.presignPut.mockImplementation(
      async (input: {
        key: string;
        contentType: string;
        batchId: string;
        mode: "create" | "replace";
        etag?: string;
      }) => ({
        url: `https://s3.test/${input.key}`,
        headers: {
          "content-type": input.contentType,
          "x-amz-meta-upload-batch": input.batchId,
          ...(input.mode === "replace"
            ? { "if-match": input.etag }
            : { "if-none-match": "*" }),
        },
        expiresAt: 123,
      })
    );
    adapter.presignParts.mockImplementation(
      async (input: { partNumbers: number[] }) =>
        input.partNumbers.map((partNumber) => ({
          partNumber,
          url: `https://s3.test/part-${partNumber}`,
        }))
    );
  });

  it("rejects a non-admin caller", async () => {
    await fakeDb.ref("users/user-1/roles").set({ user: true });
    await seedBatch(batch());

    await expect(invoke({ batchId: "batch-1", role: "video" }, "user-1")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects a foreign uid, wrong status, and unknown asset", async () => {
    await seedAdmin();
    await seedBatch(batch({ uid: "other" }));
    await expect(
      invoke({ batchId: "batch-1", role: "video" })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await seedBatch(batch({ status: "finalized" }));
    await expect(
      invoke({ batchId: "batch-1", role: "video" })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await seedBatch(batch());
    await expect(
      invoke({ batchId: "batch-1", role: "audio" })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      invoke({ batchId: "batch-1", role: "thumbnail" })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects an unknown track index", async () => {
    await seedAdmin();
    await seedBatch(
      batch({
        kind: "audio-album",
        assets: [
          {
            role: "track",
            key: "Music/Albums/Le+Cours/a.mp3",
            contentType: "audio/mpeg",
            size: 10,
            multipart: false,
            uploadId: null,
            parts: [],
          },
        ],
      })
    );

    await expect(
      invoke({ batchId: "batch-1", role: "track", trackIndex: 3 })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("uses the per-batch rate-limit budget", async () => {
    await seedAdmin();
    await seedBatch(batch());
    await seedBatch(batch(), "batch-2");
    await fakeDb.ref("rateLimits/media-resume-batch/batch-1").set({
      windowStart: Date.now(),
      count: 400,
    });

    await expect(
      invoke({ batchId: "batch-1", role: "video" })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    await expect(
      invoke({ batchId: "batch-2", role: "video" })
    ).resolves.toMatchObject({ uploads: expect.any(Array) });
  });

  it("mints a create-mode single ticket with content type, batch metadata, and If-None-Match", async () => {
    await seedAdmin();
    await seedBatch(batch());

    const result = (await invoke({ batchId: "batch-1", role: "video" })) as {
      uploads: Array<Record<string, unknown>>;
    };

    expect(adapter.presignPut).toHaveBeenCalledWith({
      key: videoKey("clip"),
      contentType: "video/mp4",
      batchId: "batch-1",
      mode: "create",
      etag: undefined,
      expiresInSeconds: TICKET_TTL_SECONDS,
    });
    expect(result.uploads[0]).toMatchObject({
      role: "video",
      key: videoKey("clip"),
      mode: "single",
      method: "PUT",
      url: `https://s3.test/${videoKey("clip")}`,
      headers: {
        "content-type": "video/mp4",
        "x-amz-meta-upload-batch": "batch-1",
        "if-none-match": "*",
      },
      expiresAt: 123,
    });
  });

  it("mints a replace ticket with If-Match from a HEAD", async () => {
    await seedAdmin();
    await seedBatch(batch({ mode: "replace", mediaId: "rec-1" }));
    adapter.head.mockResolvedValue({
      exists: true,
      etag: '"etag-1"',
      size: 1000,
      contentType: "video/mp4",
      metadata: { "upload-batch": "batch-1" },
    });

    const result = (await invoke({ batchId: "batch-1", role: "video" })) as {
      uploads: Array<Record<string, unknown>>;
    };

    expect(adapter.head).toHaveBeenCalledWith(videoKey("clip"));
    expect(adapter.presignPut).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "replace", etag: '"etag-1"' })
    );
    expect(result.uploads[0].headers).toMatchObject({
      "if-match": '"etag-1"',
    });
  });

  it("paginates multipart parts at one hundred per call and preserves numbers", async () => {
    await seedAdmin();
    const partCount = 101;
    const size = partCount * MULTIPART_PART_BYTES;
    await seedBatch(
      batch({
        assets: [
          {
            role: "video",
            key: videoKey("clip"),
            contentType: "video/mp4",
            size,
            multipart: true,
            uploadId: "upload-1",
            parts: [],
          },
        ],
      })
    );

    const first = (await invoke({
      batchId: "batch-1",
      role: "video",
    })) as { uploads: Array<{ parts: Array<{ partNumber: number }> }> };
    expect(first.uploads[0].parts).toHaveLength(100);
    expect(first.uploads[0].parts[0].partNumber).toBe(1);
    expect(first.uploads[0].parts[99].partNumber).toBe(100);

    const second = (await invoke({
      batchId: "batch-1",
      role: "video",
      partNumbers: [101],
    })) as { uploads: Array<{ parts: Array<{ partNumber: number }> }> };
    expect(second.uploads[0].parts).toEqual([
      { partNumber: 101, url: "https://s3.test/part-101", headers: {} },
    ]);
  });

  it("advances lastActivityAt on every resume", async () => {
    await seedAdmin();
    await seedBatch(batch());

    await invoke({ batchId: "batch-1", role: "video" });

    expect(
      (fakeDb.read("mediaUploads/batch-1/lastActivityAt") as number) ?? 0
    ).toBeGreaterThan(1);
  });

  it("does not HEAD-reject a create-mode asset that already exists", async () => {
    await seedAdmin();
    await seedBatch(batch());
    adapter.head.mockResolvedValue({
      exists: true,
      size: 1000,
      contentType: "video/mp4",
      metadata: { "upload-batch": "batch-1" },
    });

    await expect(
      invoke({ batchId: "batch-1", role: "video" })
    ).resolves.toMatchObject({ uploads: expect.any(Array) });
    expect(adapter.head).not.toHaveBeenCalled();
  });

  it("returns a HEAD verification when verifyOnly is set", async () => {
    await seedAdmin();
    await seedBatch(batch());
    adapter.head.mockResolvedValue({
      exists: true,
      size: 1000,
      contentType: "video/mp4",
      metadata: { "upload-batch": "batch-1" },
    });

    await expect(
      invoke({ batchId: "batch-1", role: "video", verifyOnly: true })
    ).resolves.toEqual({
      uploads: [],
      verification: {
        exists: true,
        batchMatches: true,
        size: 1000,
        contentType: "video/mp4",
      },
    });

    adapter.head.mockResolvedValue({ exists: false });
    await expect(
      invoke({ batchId: "batch-1", role: "video", verifyOnly: true })
    ).resolves.toEqual({
      uploads: [],
      verification: { exists: false, batchMatches: false },
    });
  });
});
