import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("./config", () => ({
  MEDIA_AWS_ACCESS_KEY_ID: { value: () => "key" },
  MEDIA_AWS_REGION: { value: () => "us-east-1" },
  MEDIA_AWS_SECRET_ACCESS_KEY: { value: () => "secret" },
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID: { value: () => "distribution" },
  MEDIA_S3_BUCKET: { value: () => "bucket" },
  emulatorMediaUrl: (key: string) => `https://sink.test/${key}`,
  isMediaEmulator: () => false,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {},
  PutObjectCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

import { getStorageAdapter } from "./storage-adapter";

function presignOptions(): {
  signableHeaders: Set<string>;
  unhoistableHeaders: Set<string>;
} {
  return mocks.getSignedUrl.mock.calls[0][2] as {
    signableHeaders: Set<string>;
    unhoistableHeaders: Set<string>;
  };
}

describe("storage adapter presign conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSignedUrl.mockResolvedValue("https://signed.test/object");
  });

  it("signs and does not hoist the conditional headers for each mode", async () => {
    const adapter = getStorageAdapter();

    await adapter.presignPut({
      key: "Video/clip.mp4",
      contentType: "video/mp4",
      batchId: "batch-1",
      mode: "create",
      expiresInSeconds: 900,
    });
    expect([...presignOptions().signableHeaders].sort()).toEqual([
      "content-type",
      "if-none-match",
      "x-amz-meta-upload-batch",
    ]);
    expect([...presignOptions().unhoistableHeaders].sort()).toEqual([
      "if-none-match",
      "x-amz-meta-upload-batch",
    ]);

    vi.clearAllMocks();
    mocks.getSignedUrl.mockResolvedValue("https://signed.test/object");
    await adapter.presignPut({
      key: "Video/clip.mp4",
      contentType: "video/mp4",
      batchId: "batch-1",
      mode: "replace",
      etag: '"etag-1"',
      expiresInSeconds: 900,
    });
    expect([...presignOptions().signableHeaders].sort()).toEqual([
      "content-type",
      "if-match",
      "x-amz-meta-upload-batch",
    ]);
    expect([...presignOptions().unhoistableHeaders].sort()).toEqual([
      "if-match",
      "x-amz-meta-upload-batch",
    ]);
  });
});
