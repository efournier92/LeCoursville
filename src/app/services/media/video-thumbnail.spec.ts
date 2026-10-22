import { vi } from "vitest";
import {
  THUMBNAIL_JPEG_QUALITY,
  captureVideoThumbnail,
  encodeJpeg,
  scaleToThumbnail,
  thumbnailSeekTime,
} from "./video-thumbnail";

const JPEG = new Blob(["jpeg"], { type: "image/jpeg" });

function fakeCanvas(context: unknown = { drawImage: vi.fn() }) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: BlobCallback) => callback(JPEG)),
  } as unknown as HTMLCanvasElement;
}

function mockCanvas(canvas = fakeCanvas()) {
  const original = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
    tag === "canvas" ? canvas : original(tag)) as typeof document.createElement);
  return canvas;
}

interface FakeVideo {
  readyState: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
  requestVideoFrameCallback?: (callback: () => void) => number;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  fire: (event: string) => void;
}

function fakeVideo(overrides: Partial<FakeVideo> = {}): FakeVideo {
  const handlers: Record<string, Array<() => void>> = {};
  const video: FakeVideo = {
    readyState: 2,
    duration: 100,
    videoWidth: 1920,
    videoHeight: 1080,
    currentTime: 0,
    addEventListener: (event, handler) => {
      (handlers[event] ??= []).push(handler);
    },
    removeEventListener: (event, handler) => {
      handlers[event] = (handlers[event] ?? []).filter(entry => entry !== handler);
    },
    fire: event => {
      for (const handler of [...(handlers[event] ?? [])]) {
        handler();
      }
    },
    ...overrides,
  };
  return video;
}

function asVideo(video: FakeVideo): HTMLVideoElement {
  return video as unknown as HTMLVideoElement;
}

describe("thumbnail seek time", () => {
  it("seeks ten percent in", () => {
    expect(thumbnailSeekTime(100)).toBe(10);
    expect(thumbnailSeekTime(20)).toBe(2);
  });

  it("clamps to 0.05 at both ends and never seeks to zero", () => {
    expect(thumbnailSeekTime(0.2)).toBe(0.05);
    expect(thumbnailSeekTime(0.06)).toBe(0.05);
    expect(thumbnailSeekTime(0)).toBe(0.05);
  });
});

describe("thumbnail scale", () => {
  it("scales landscape, portrait, small, and zero-dimension inputs", () => {
    expect(scaleToThumbnail(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(scaleToThumbnail(3840, 2160)).toEqual({ width: 1280, height: 720 });
    expect(scaleToThumbnail(1080, 1920)).toEqual({ width: 405, height: 720 });
    expect(scaleToThumbnail(640, 480)).toEqual({ width: 640, height: 480 });
    expect(scaleToThumbnail(0, 0)).toEqual({ width: 0, height: 0 });
    expect(scaleToThumbnail(-10, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe("thumbnail jpeg encoding", () => {
  afterEach(() => vi.restoreAllMocks());

  it("encodes image/jpeg at the documented quality", async () => {
    const toBlob = vi.fn((callback: BlobCallback) => callback(JPEG));
    const canvas = { toBlob } as unknown as HTMLCanvasElement;

    const blob = await encodeJpeg(canvas);

    expect(blob).toBe(JPEG);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", THUMBNAIL_JPEG_QUALITY);
  });
});

describe("video frame capture", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses requestVideoFrameCallback when present", async () => {
    const canvas = mockCanvas();
    const frameCallback = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    const video = fakeVideo({ requestVideoFrameCallback: frameCallback });

    const blob = await captureVideoThumbnail(asVideo(video));

    expect(blob).toBe(JPEG);
    expect(frameCallback).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(10);
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
  });

  it("waits for loadedmetadata and falls back to seeked", async () => {
    mockCanvas();
    const video = fakeVideo({ readyState: 0 });

    const capture = captureVideoThumbnail(asVideo(video));
    await Promise.resolve();
    video.fire("loadedmetadata");
    await Promise.resolve();
    video.fire("seeked");

    expect(await capture).toBe(JPEG);
    expect(video.currentTime).toBe(10);
  });

  it("returns null and requests the manual override when the duration is unusable", async () => {
    mockCanvas();
    const video = fakeVideo({ duration: Number.NaN });

    expect(await captureVideoThumbnail(asVideo(video))).toBeNull();
  });

  it("returns null when the canvas context is unavailable", async () => {
    mockCanvas(fakeCanvas(null));
    const video = fakeVideo({ requestVideoFrameCallback: callback => (callback(), 1) });

    expect(await captureVideoThumbnail(asVideo(video))).toBeNull();
  });

  it("returns null instead of throwing when seeking fails", async () => {
    mockCanvas();
    const video = fakeVideo();
    Object.defineProperty(video, "currentTime", {
      set: () => {
        throw new Error("seek failed");
      },
    });

    expect(await captureVideoThumbnail(asVideo(video))).toBeNull();
  });
});
