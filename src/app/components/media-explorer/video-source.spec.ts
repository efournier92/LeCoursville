import { describe, expect, it } from 'vitest';

import { isExternalDriveUrl } from './video-source';

describe('isExternalDriveUrl', () => {
  it.each([
    'https://drive.google.com/file/d/abc/preview',
    'http://drive.google.com/file/d/abc/view',
    'https://www.drive.google.com/file/d/abc/view',
    'https://docs.google.com/file/d/abc/view',
    'https://docs.google.com/uc?id=abc',
    'https://docs.google.com/open?id=abc',
  ])('routes %s to the Drive iframe', (url) => {
    expect(isExternalDriveUrl(url)).toBe(true);
  });

  it.each([
    'https://assets.lecoursville.com/Video/x.mp4',
    'https://firebasestorage.googleapis.com/v0/b/bucket/o/video.mp4?alt=media&token=abc',
    'http://localhost:5000/assets/e2e-fixtures/fixture.mp4',
    'https://example.com/media/clip.mp4',
    undefined,
    null,
    '',
  ])('leaves %s on the native player', (url) => {
    expect(isExternalDriveUrl(url)).toBe(false);
  });
});
