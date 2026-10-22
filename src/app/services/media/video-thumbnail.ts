export const THUMBNAIL_MAX_WIDTH = 1280;
export const THUMBNAIL_MAX_HEIGHT = 720;
export const THUMBNAIL_JPEG_QUALITY = 0.82;

export interface ThumbnailSize {
  width: number;
  height: number;
}

/** Ten percent in, clamped so a seek never lands exactly on zero or the final frame. */
export function thumbnailSeekTime(duration: number): number {
  return Math.min(
    Math.max(duration * 0.1, 0.05),
    Math.max(duration - 0.1, 0.05)
  );
}

export function scaleToThumbnail(width: number, height: number): ThumbnailSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(
    1,
    THUMBNAIL_MAX_WIDTH / width,
    THUMBNAIL_MAX_HEIGHT / height
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function encodeJpeg(
  canvas: HTMLCanvasElement,
  quality = THUMBNAIL_JPEG_QUALITY
): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
}

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise(resolve => {
    const handler = () => {
      target.removeEventListener(event, handler);
      resolve();
    };
    target.addEventListener(event, handler, { once: true });
  });
}

export async function captureVideoThumbnail(
  video: HTMLVideoElement
): Promise<Blob | null> {
  try {
    if (!(video.readyState >= 1)) {
      await once(video, "loadedmetadata");
    }
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      return null;
    }

    const frameReady =
      typeof video.requestVideoFrameCallback === "function"
        ? new Promise<void>(resolve =>
            video.requestVideoFrameCallback(() => resolve())
          )
        : once(video, "seeked");
    video.currentTime = thumbnailSeekTime(duration);
    await frameReady;

    const size = scaleToThumbnail(video.videoWidth, video.videoHeight);
    if (!size.width || !size.height) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(video, 0, 0, size.width, size.height);
    return await encodeJpeg(canvas);
  } catch {
    return null;
  }
}
