import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import { createUserUpload, safeSegment } from "./create-user-upload";
import { fakeDb, resetFakeState } from "./test-support";

function invoke(data: Record<string, unknown>) {
  return createUserUpload.run({ data, rawRequest: {} } as never) as Promise<{
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

  it("sanitizes a segment independently", () => {
    expect(safeSegment("a/b\\c", "fallback")).toBe("a_b_c");
    expect(safeSegment("..", "fallback")).toBe("fallback");
    expect(safeSegment("  ", "fallback")).toBe("fallback");
    expect(safeSegment("photo.png", "fallback")).toBe("photo.png");
  });
});
