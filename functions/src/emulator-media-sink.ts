import { createHash } from "crypto";
import type { Response } from "express";
import { onRequest, type Request } from "firebase-functions/v2/https";
import { REGION } from "./config";

const CORS_ORIGIN = "http://localhost:5000";

interface SinkObject {
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
  etag: string;
}

const objects = new Map<string, SinkObject>();

function etagFor(body: Buffer): string {
  return `"${createHash("md5").update(body).digest("hex")}"`;
}

function unquoteEtag(value: string): string {
  return value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
}

function header(req: Request, name: string): string {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return typeof value === "string" ? value : "";
}

function queryValue(req: Request, name: string): string {
  const value = (req.query as Record<string, unknown>)[name];
  if (typeof value === "string") {
    return value;
  }
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
}

function requestBody(req: Request): Buffer {
  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  const body = req.body as unknown;
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  return body instanceof Uint8Array ? Buffer.from(body) : Buffer.alloc(0);
}

function parseRange(value: string, total: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const rawStart = match[1];
  const rawEnd = match[2];
  let start: number;
  let end: number;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return null;
    }
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : total - 1;
  }
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= total ||
    end < start
  ) {
    return null;
  }
  return { start, end: Math.min(end, total - 1) };
}

function setObjectHeaders(res: Response, record: SinkObject): void {
  res.setHeader("Content-Type", record.contentType);
  res.setHeader("Content-Length", String(record.body.length));
  res.setHeader("ETag", record.etag);
  res.setHeader("x-amz-meta-upload-batch", record.metadata["upload-batch"] ?? "");
}

export async function emulatorMediaSinkHandler(
  req: Request,
  res: Response
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);

  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    res.status(404).end();
    return;
  }

  const method = (req.method ?? "").toUpperCase();
  if (method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, if-none-match, if-match, x-amz-meta-upload-batch"
    );
    res.setHeader("Access-Control-Max-Age", "3600");
    res.status(204).end();
    return;
  }

  if (method === "POST" && queryValue(req, "reset") === "1") {
    objects.clear();
    res.status(200).end();
    return;
  }

  const key = queryValue(req, "key");
  if (!key) {
    res.status(400).end();
    return;
  }

  if (method === "PUT") {
    const existing = objects.get(key);
    const ifNoneMatch = header(req, "if-none-match");
    if (ifNoneMatch === "*" && existing) {
      res.status(412).end();
      return;
    }
    const ifMatch = header(req, "if-match");
    if (ifMatch) {
      const matches =
        ifMatch === "*"
          ? !!existing
          : !!existing && unquoteEtag(ifMatch) === unquoteEtag(existing.etag);
      if (!matches) {
        res.status(412).end();
        return;
      }
    }

    const body = requestBody(req);
    const batch = header(req, "x-amz-meta-upload-batch");
    const record: SinkObject = {
      body,
      contentType: header(req, "content-type") || "application/octet-stream",
      metadata: batch ? { "upload-batch": batch } : {},
      etag: etagFor(body),
    };
    objects.set(key, record);
    res.setHeader("ETag", record.etag);
    res.status(200).end();
    return;
  }

  if (method === "DELETE") {
    res.status(objects.delete(key) ? 204 : 404).end();
    return;
  }

  if (method === "HEAD") {
    const record = objects.get(key);
    if (!record) {
      res.status(404).end();
      return;
    }
    setObjectHeaders(res, record);
    res.status(200).end();
    return;
  }

  if (method === "GET") {
    const record = objects.get(key);
    if (!record) {
      res.status(404).end();
      return;
    }
    setObjectHeaders(res, record);
    const range = parseRange(header(req, "range"), record.body.length);
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${record.body.length}`);
      res.setHeader("Content-Length", String(range.end - range.start + 1));
      res.end(record.body.subarray(range.start, range.end + 1));
      return;
    }
    res.status(200).end(record.body);
    return;
  }

  res.status(405).end();
}

export const emulatorMediaSink = onRequest(
  { region: REGION },
  emulatorMediaSinkHandler
);

export interface SinkHead {
  size: number;
  contentType: string;
  etag: string;
  metadata: Record<string, string>;
}

export function resetSink(): void {
  objects.clear();
}

export function sinkHead(key: string): SinkHead | null {
  const record = objects.get(key);
  return record
    ? {
        size: record.body.length,
        contentType: record.contentType,
        etag: record.etag,
        metadata: { ...record.metadata },
      }
    : null;
}

export function sinkGet(key: string): Buffer | null {
  return objects.get(key)?.body ?? null;
}

export function sinkMetadata(key: string): Record<string, string> | null {
  const record = objects.get(key);
  return record ? { ...record.metadata } : null;
}

export function deleteSinkObjects(keys: string[]): number {
  let deleted = 0;
  for (const key of keys) {
    if (objects.delete(key)) {
      deleted += 1;
    }
  }
  return deleted;
}
