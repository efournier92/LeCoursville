/**
 * HTTP access to the emulator media sink. The sink keeps its objects in the
 * functions process, so assertions read them over HTTP rather than through a
 * shared module instance.
 */

export const SINK_BASE =
  'http://localhost:5001/lecoursville-dev/us-central1/emulatorMediaSink';

export function sinkUrl(key: string): string {
  return `${SINK_BASE}?key=${encodeURIComponent(key)}`;
}

export async function resetSink(): Promise<void> {
  const response = await fetch(`${SINK_BASE}?reset=1`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`emulatorMediaSink reset -> HTTP ${response.status}`);
  }
}

/** The functions emulator can take a moment to accept connections after boot. */
export async function resetSinkWithRetry(attempts = 40, delayMs = 250): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await resetSink();
      return;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`emulatorMediaSink never accepted the reset: ${String(lastError)}`);
}

export interface SinkHead {
  size: number;
  contentType: string;
  etag: string;
  batchId: string | null;
}

export async function sinkHead(key: string): Promise<SinkHead | null> {
  const response = await fetch(sinkUrl(key), { method: 'HEAD' });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`emulatorMediaSink HEAD ${key} -> HTTP ${response.status}`);
  }
  return {
    size: Number(response.headers.get('content-length') ?? 0),
    contentType: response.headers.get('content-type') ?? '',
    etag: response.headers.get('etag') ?? '',
    batchId: response.headers.get('x-amz-meta-upload-batch') || null,
  };
}

export async function sinkPut(
  key: string,
  body: Buffer | Uint8Array,
  options: { contentType?: string; batchId?: string } = {},
): Promise<void> {
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'application/octet-stream',
  };
  if (options.batchId) {
    headers['x-amz-meta-upload-batch'] = options.batchId;
  }
  const response = await fetch(sinkUrl(key), {
    method: 'PUT',
    headers,
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    throw new Error(`emulatorMediaSink PUT ${key} -> HTTP ${response.status}`);
  }
}

export async function sinkGet(key: string): Promise<Buffer | null> {
  const response = await fetch(sinkUrl(key));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`emulatorMediaSink GET ${key} -> HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
