import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { MediaExplorerComponent } from './media-explorer.component';
import { UploadableMedia } from 'src/app/models/media/media';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { PromptModalService } from 'src/app/services/prompt-modal.service';
import { RoutingService } from 'src/app/services/routing.service';

function videoMedia(urls: { download: string; icon?: string }): UploadableMedia {
  return {
    id: 'video-1',
    title: 'Video',
    type: 'video',
    format: 'video/mp4',
    artist: '',
    date: '2026',
    folderName: '',
    fileName: 'video.mp4',
    isSticky: false,
    isHidden: false,
    listing: [],
    urls: { download: urls.download, icon: urls.icon as string },
    dateUpdated: new Date(),
  };
}

describe('MediaExplorerComponent video player branch', () => {
  let component: MediaExplorerComponent;
  let fixture: ComponentFixture<MediaExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MediaExplorerComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthService,
          useValue: {
            userObservable: of({ id: 'u1', roles: { user: true } }),
            isUserSignedIn: () => true,
          },
        },
        { provide: MediaService, useValue: { mediaObservable: of([]), getMediaById: () => ({}) } },
        { provide: AnalyticsService, useValue: { logEvent: vi.fn() } },
        { provide: RoutingService, useValue: { clearQueryParams: vi.fn(), NavigateToSignIn: vi.fn() } },
        { provide: ActivatedRoute, useValue: { queryParams: of({}), snapshot: { queryParams: {} } } },
        { provide: Clipboard, useValue: { copy: vi.fn() } },
        { provide: PromptModalService, useValue: { openDialog: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MediaExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the Drive iframe for a Drive URL', () => {
    component.selectedMedia = videoMedia({
      download: 'https://drive.google.com/file/d/abc/preview',
      icon: 'https://assets.lecoursville.com/Video/Icons/abc.jpg',
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-video-player-drive-iframe'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="native-video-player"]'),
    ).toBeNull();
  });

  it('renders native video with src and poster for a CloudFront URL', () => {
    const download = 'https://assets.lecoursville.com/Video/trip.mp4';
    const icon = 'https://assets.lecoursville.com/Video/Icons/trip.jpg';
    component.selectedMedia = videoMedia({ download, icon });
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector(
      '[data-testid="native-video-player"]',
    ) as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute('src')).toBe(download);
    expect(video.getAttribute('poster')).toBe(icon);
    expect(
      fixture.nativeElement.querySelector('app-video-player-drive-iframe'),
    ).toBeNull();
  });

  it('renders native video for any other external URL', () => {
    component.selectedMedia = videoMedia({
      download: 'https://example.com/media/clip.mp4',
      icon: 'https://example.com/media/clip.jpg',
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="native-video-player"]'),
    ).not.toBeNull();
  });

  it('renders native video without a poster when the icon is missing', () => {
    component.selectedMedia = videoMedia({
      download: 'https://assets.lecoursville.com/Video/no-icon.mp4',
    });
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector(
      '[data-testid="native-video-player"]',
    ) as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute('poster')).toBeFalsy();
  });
});
