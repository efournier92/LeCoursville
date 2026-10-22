import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import {
  createUserUpload,
  GLOBAL_MAX,
  MAX_UPLOAD_BYTES,
  PER_ACTOR_MAX,
  safeSegment,
} from "./create-user-upload";
import { fakeDb, resetFakeState } from "./test-support";

function invoke(
  data: Record<string, unknown>,
  rawRequest: Record<string, unknown> = {}
) {
  return createUserUpload.run({ data, rawRequest } as never) as Promise<{
    id: string;
    path: string;
  }>;
}

const validData = {
  fileName: "family photo.png",
  fileType: "image/png",
  fileSize: 1234,
  eventName: "Reunion",
  batchId: "Reunion_Anonymous_2026-10-22-120000",
  uploader: { name: "Guest", email: "guest@example.com", anonymousId: "anon_123" },
};

describe("createUserUpload", () => {
  beforeEach(() => resetFakeState());

  it("records a pending upload under a server-assigned path", async () => {
    const result = await invoke(validData);

    expect(result.id).toBeTruthy();
    expect(result.path).toBe(
      `userUploads/${result.id}/Reunion_Anonymous_2026-10-22-120000/family_photo.png`
    );
    const record = fakeDb.read(`userUploads/${result.id}`) as Record<string, unknown>;
    expect(record).toMatchObject({
      id: result.id,
      url: "",
      path: result.path,
      status: "pending",
      eventName: "Reunion",
      fileName: "family_photo.png",
      fileType: "image/png",
      fileSize: 1234,
      uploader: { name: "Guest", email: "guest@example.com", anonymousId: "anon_123" },
    });
    expect(typeof record.dateAdded).toBe("number");
  });

  it("ignores client attempts to set id, path, status, or url", async () => {
    const result = await invoke({
      ...validData,
      id: "attacker-id",
      path: "photos/album-1/photo1.png",
      status: "approved",
      url: "https://evil.example/x.png",
    });

    const record = fakeDb.read(`userUploads/${result.id}`) as Record<string, unknown>;
    expect(record.id).toBe(result.id);
    expect(record.path).toMatch(new RegExp(`^userUploads/${result.id}/`));
    expect(record.status).toBe("pending");
    expect(record.url).toBe("");
  });

  it("strips traversal and separators from every path segment", async () => {
    const result = await invoke({
      ...validData,
      fileName: "../../escape file.png",
      batchId: "..\\../batch/name",
    });

    expect(result.path).not.toContain("..");
    expect(result.path).not.toContain("\\\\");
    expect(result.path).toBe(`userUploads/${result.id}/batch_name/escape_file.png`);
  });

  it("rejects a missing file name", async () => {
    await expect(invoke({ ...validData, fileName: "" })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(invoke({ ...validData, fileName: undefined })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects control characters and oversized fields", async () => {
    const invalid = [
      { eventName: "Reunion\nInjected" },
      { fileName: "photo.png\n" },
      { fileName: "a".repeat(256) },
      { batchId: "b".repeat(121) },
      { fileType: "x".repeat(101) },
    ];
    for (const override of invalid) {
      await expect(invoke({ ...validData, ...override })).rejects.toMatchObject({
        code: "invalid-argument",
      });
    }
    expect(fakeDb.read("userUploads")).toBeNull();
  });

  it("rejects the call past the per-actor cap and writes no row", async () => {
    const rawRequest = { ip: "203.0.113.9" };
    for (let i = 0; i < PER_ACTOR_MAX; i++) {
      await invoke({ ...validData, fileName: `photo-${i}.png` }, rawRequest);
    }
    const before = Object.keys(fakeDb.read("userUploads") as object).length;

    await expect(
      invoke({ ...validData, fileName: "capped.png" }, rawRequest)
    ).rejects.toMatchObject({ code: "resource-exhausted" });

    expect(Object.keys(fakeDb.read("userUploads") as object)).toHaveLength(before);
  });

  it("keys per-actor budgets on the forwarded hop, not the shared socket", async () => {
    const socket = "10.0.0.1";
    const hopA = {
      ip: socket,
      headers: { "x-forwarded-for": "spoof, 203.0.113.1" },
    };
    const hopB = {
      ip: socket,
      headers: { "x-forwarded-for": "spoof, 203.0.113.2" },
    };
    for (let i = 0; i < PER_ACTOR_MAX; i++) {
      await invoke({ ...validData, fileName: `a-${i}.png` }, hopA);
    }

    await expect(
      invoke({ ...validData, fileName: "a-capped.png" }, hopA)
    ).rejects.toMatchObject({ code: "resource-exhausted" });

    // A different client behind the same proxy gets its own budget.
    await expect(
      invoke({ ...validData, fileName: "b-first.png" }, hopB)
    ).resolves.toMatchObject({ id: expect.any(String) });

    // Replaying hop A still shares its one exhausted budget.
    await expect(
      invoke({ ...validData, fileName: "a-again.png" }, hopA)
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("rejects a file above the server-side size limit before writing a row", async () => {
    await expect(
      invoke({ ...validData, fileSize: MAX_UPLOAD_BYTES + 1 })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fakeDb.read("userUploads")).toBeNull();
  });

  it("soft-degrades at the global cap instead of blocking guests", async () => {
    await fakeDb.ref("rateLimits/userUploadsGlobal/global").set({
      windowStart: Date.now(),
      count: GLOBAL_MAX,
    });

    const first = await invoke({ ...validData, fileName: "over-1.png" });
    const second = await invoke({ ...validData, fileName: "over-2.png" });
    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(Object.keys(fakeDb.read("userUploads") as object)).toHaveLength(2);

    const alerts = fakeDb.read("adminAlerts") as Record<string, { type?: string }>;
    expect(
      Object.values(alerts).filter((alert) => alert.type === "upload_global_cap")
    ).toHaveLength(1);
    expect(fakeDb.read("rateLimits/userUploadsGlobalAlert/global")).toBeTruthy();
  });

  it("sanitizes a segment independently", () => {
    expect(safeSegment("a/b\\c", "fallback")).toBe("a_b_c");
    expect(safeSegment("..", "fallback")).toBe("fallback");
    expect(safeSegment("  ", "fallback")).toBe("fallback");
    expect(safeSegment("photo.png", "fallback")).toBe("photo.png");
  });
});
