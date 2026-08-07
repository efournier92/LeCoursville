import { Injectable } from '@angular/core';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import PhotoSwipe from 'photoswipe';

@Injectable({ providedIn: 'root' })
export class PhotoswipeService {
  private lightbox: PhotoSwipeLightbox | null = null;

  initForGallery(gallerySelector: string): void {
    if (this.lightbox) {
      this.lightbox.destroy();
    }
    this.lightbox = new PhotoSwipeLightbox({
      gallery: gallerySelector,
      children: 'a',
      pswpModule: PhotoSwipe,
      bgOpacity: 0.95,
      showHideAnimationType: 'fade',
      padding: { top: 20, bottom: 40, left: 20, right: 20 },
    });
    this.lightbox.on('uiRegister', () => {
      this.lightbox?.pswp.ui.registerElement({
        name: 'download-button',
        order: 8,
        isButton: true,
        tagName: 'a',
        title: 'Download',
        ariaLabel: 'Download photo',
        html:
          '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" class="pswp__icn">' +
          '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" /></svg>',
        onInit: (el: HTMLAnchorElement, pswp: PhotoSwipe) => {
          el.setAttribute('download', '');
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener');
          pswp.on('change', () => {
            const src = pswp.currSlide.data.src;
            el.href = src;
            el.setAttribute('download', this.fileNameFromUrl(src));
          });
        },
      });
    });
    this.lightbox.init();
  }

  private fileNameFromUrl(url: string): string {
    try {
      // Firebase Storage URLs: .../v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
      const path = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
      const name = path.split('/').pop() || '';
      return name || 'photo.jpg';
    } catch {
      return 'photo.jpg';
    }
  }

  openAtIndex(index: number): void {
    this.lightbox?.loadAndOpen(index);
  }

  destroy(): void {
    this.lightbox?.destroy();
    this.lightbox = null;
  }
}
