const DRIVE_HOST = /^https?:\/\/(www\.)?drive\.google\.com\//i;
const DOCS_PATH = /^https?:\/\/docs\.google\.com\/(?:open\?|file\/d\/|uc\?)/i;

// Google-hosted videos must use the embeddable iframe player, not <video>.
export function isExternalDriveUrl(url: string | undefined | null): boolean {
  if (!url) {
    return false;
  }
  return DRIVE_HOST.test(url) || DOCS_PATH.test(url);
}
