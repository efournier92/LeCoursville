import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  emulatorMediaSinkHandler,
  resetSink,
  sinkGet,
  sinkHead,
  sinkMetadata,
} from "./emulator-media-sink";
import { getStorageAdapter } from "./media/storage-adapter";

const ORIGIN = "http://localhost:5000";
const KEY = "Video/clip.mp4";

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
  status(code: number): MockResponse;
  setHeader(name: string, value: string): void;
  end(body?: unknown): void;
}

function makeResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: Buffer.alloc(0),
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
    },
    end(body) {
      if (body !== undefined) {
        res.body = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      }
    },
  };
  return res;
}

interface MockRequest {
  method: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  rawBody: Buffer;
}

async function call(overrides: Partial<MockRequest>): Promise<MockResponse> {
  const res = makeResponse();
  const req: MockRequest = {
    method: "GET",
    query: {},
    headers: {},
    rawBody: Buffer.alloc(0),
    ...overrides,
  };
  await emulatorMediaSinkHandler(req as never, res as never);
  return res;
}

function put(
  key: string,
  body: string,
  headers: Record<string, string> = {}
): Promise<MockResponse> {
  return call({
    method: "PUT",
    query: { key },
    headers: {
      "content-type": "video/mp4",
      "x-amz-meta-upload-batch": "batch-1",
      ...headers,
    },
    rawBody: Buffer.from(body),
  });
}

const originalEmulator = process.env.FUNCTIONS_EMULATOR;
const originalProject = process.env.GCLOUD_PROJECT;

beforeEach(() => {
  process.env.FUNCTIONS_EMULATOR = "true";
  process.env.GCLOUD_PROJECT = "lecoursville-dev";
  resetSink();
});

afterEach(() => {
  if (originalEmulator === undefined) {
    delete process.env.FUNCTIONS_EMULATOR;
  } else {
    process.env.FUNCTIONS_EMULATOR = originalEmulator;
  }
  if (originalProject === undefined) {
    delete process.env.GCLOUD_PROJECT;
  } else {
    process.env.GCLOUD_PROJECT = originalProject;
  }
});

describe("emulatorMediaSink production guard", () => {
  it("returns 404 with an empty body for every method outside the emulator", async () => {
    delete process.env.FUNCTIONS_EMULATOR;
    for (const method of ["GET", "HEAD", "PUT", "POST", "OPTIONS"]) {
      const res = await call({
        method,
        query: method === "POST" ? { reset: "1" } : { key: KEY },
        headers: { "x-amz-meta-upload-batch": "batch-1" },
        rawBody: Buffer.from("bytes"),
      });
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveLength(0);
    }
  });
});

describe("emulatorMediaSink PUT", () => {
  it("stores bytes, content type, and batch metadata with a deterministic etag", async () => {
    const res = await put(KEY, "hello world");

    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
    const head = sinkHead(KEY);
    expect(head).toMatchObject({
      size: 11,
      contentType: "video/mp4",
      metadata: { "upload-batch": "batch-1" },
    });
    expect(head?.etag).toBe(res.headers.etag);
    expect(sinkGet(KEY)?.toString()).toBe("hello world");
    expect(sinkMetadata(KEY)).toEqual({ "upload-batch": "batch-1" });
  });

  it("rejects If-None-Match: * when the key already exists", async () => {
    await put(KEY, "first");

    const res = await put(KEY, "second", { "if-none-match": "*" });

    expect(res.statusCode).toBe(412);
    expect(sinkGet(KEY)?.toString()).toBe("first");
  });

  it("rejects an If-Match etag mismatch and accepts a match", async () => {
    await put(KEY, "first");
    const etag = sinkHead(KEY)?.etag ?? "";

    const stale = await put(KEY, "second", { "if-match": '"stale"' });
    expect(stale.statusCode).toBe(412);
    expect(sinkGet(KEY)?.toString()).toBe("first");

    const current = await put(KEY, "second", { "if-match": etag });
    expect(current.statusCode).toBe(200);
    expect(sinkGet(KEY)?.toString()).toBe("second");
  });

  it("rejects If-Match against a missing key", async () => {
    const res = await put("Video/missing.mp4", "body", { "if-match": '"etag"' });
    expect(res.statusCode).toBe(412);
  });
});

describe("emulatorMediaSink HEAD and GET", () => {
  it("reflects existence, size, content type, etag, and batch metadata", async () => {
    await put(KEY, "hello world");

    const res = await call({ method: "HEAD", query: { key: KEY } });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("video/mp4");
    expect(res.headers["content-length"]).toBe("11");
    expect(res.headers.etag).toBe(sinkHead(KEY)?.etag);
    expect(res.headers["x-amz-meta-upload-batch"]).toBe("batch-1");
    expect(res.body).toHaveLength(0);
  });

  it("returns 404 for a missing key", async () => {
    const res = await call({ method: "HEAD", query: { key: "Video/missing.mp4" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns the body and a single ranged response", async () => {
    await put(KEY, "hello world");

    const full = await call({ method: "GET", query: { key: KEY } });
    expect(full.statusCode).toBe(200);
    expect(full.body.toString()).toBe("hello world");

    const ranged = await call({
      method: "GET",
      query: { key: KEY },
      headers: { range: "bytes=0-4" },
    });
    expect(ranged.statusCode).toBe(206);
    expect(ranged.headers["content-range"]).toBe("bytes 0-4/11");
    expect(ranged.headers["content-length"]).toBe("5");
    expect(ranged.body.toString()).toBe("hello");

    const suffix = await call({
      method: "GET",
      query: { key: KEY },
      headers: { range: "bytes=-5" },
    });
    expect(suffix.statusCode).toBe(206);
    expect(suffix.headers["content-range"]).toBe("bytes 6-10/11");
    expect(suffix.body.toString()).toBe("world");
  });
});

describe("emulatorMediaSink reset and CORS", () => {
  it("clears every stored object on POST ?reset=1", async () => {
    await put(KEY, "hello world");

    const res = await call({ method: "POST", query: { reset: "1" } });

    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(sinkHead(KEY)).toBeNull();
  });

  it("answers OPTIONS with the documented CORS headers", async () => {
    const res = await call({ method: "OPTIONS" });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(res.headers["access-control-allow-methods"]).toBe(
      "GET, HEAD, PUT, OPTIONS"
    );
    expect(res.headers["access-control-allow-headers"]).toBe(
      "content-type, if-none-match, if-match, x-amz-meta-upload-batch"
    );
    expect(res.headers["access-control-max-age"]).toBe("3600");
  });
});

describe("emulator storage adapter", () => {
  it("mints single PUT tickets and never multipart", async () => {
    const adapter = getStorageAdapter();

    const ticket = await adapter.presignPut({
      key: KEY,
      contentType: "video/mp4",
      batchId: "batch-1",
      mode: "create",
      expiresInSeconds: 900,
    });
    expect(ticket.url).toBe(
      "http://localhost:5001/lecoursville-dev/us-central1/emulatorMediaSink?key=Video%2Fclip.mp4"
    );
    expect(ticket.headers["if-none-match"]).toBe("*");
    expect(ticket.headers["x-amz-meta-upload-batch"]).toBe("batch-1");

    await expect(
      adapter.createMultipart({
        key: KEY,
        contentType: "video/mp4",
        batchId: "batch-1",
      })
    ).rejects.toThrow("not supported");
  });
});
