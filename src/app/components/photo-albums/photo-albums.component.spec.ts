import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';
import { PhotoAlbumsComponent } from './photo-albums.component';
import { PhotoAlbumsService } from 'src/app/services/photo-albums.service';
import { PhotosService } from 'src/app/services/photos.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { Router } from '@angular/router';
import { PhotoAlbum } from 'src/app/models/photo-album';

describe('PhotoAlbumsComponent', () => {
  let component: PhotoAlbumsComponent;
  let fixture: ComponentFixture<PhotoAlbumsComponent>;
  let albums$: Subject<PhotoAlbum[] | null>;
  let photos$: Subject<any[]>;

  beforeEach(async () => {
    albums$ = new Subject();
    photos$ = new Subject();
    await TestBed.configureTestingModule({
      declarations: [PhotoAlbumsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        // Getter so onRetry()'s resubscribe can be handed a live stream:
        // a Subject that errored is terminal and would fail the retry test
        // for the wrong reason.
        { provide: PhotoAlbumsService, useValue: { get albums$() { return albums$.asObservable(); } } },
        { provide: PhotosService, useValue: { nonMessagePhotos$: photos$.asObservable() } },
        { provide: AnalyticsService, useValue: { logEvent: () => {} } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoAlbumsComponent);
    component = fixture.componentInstance;
    // Bootstrap so ngOnInit has subscribed before tests emit on the fake
    // streams (Subjects do not replay; pre-init emissions would be lost).
    fixture.detectChanges();
  });

  it('shows skeleton tiles until the first real snapshot', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.skeleton-tile').length).toBe(6);
    expect(el.querySelector('app-load-error')).toBeNull();
  });

  it('treats the null seed as loading, an empty snapshot as the empty state', () => {
    // null is the service's not-yet-loaded seed.
    albums$.next(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.skeleton-tile').length).toBe(6);

    albums$.next([]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.skeleton-tile').length).toBe(0);
    // Child content is not rendered under NO_ERRORS_SCHEMA, so assert the
    // element and its inputs rather than projected text.
    const empty = el.querySelector('app-no-results-message');
    expect(empty).not.toBeNull();
  });

  it('renders album tiles once a populated snapshot arrives', () => {
    albums$.next([{ id: 'a1', title: 'E2E Album One', updatedAt: 1 } as PhotoAlbum]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.skeleton-tile').length).toBe(0);
    expect(el.querySelectorAll('.album-tile').length).toBe(1);
    expect(el.textContent).toContain('E2E Album One');
  });

  it('shows the error component on stream failure and recovers on retry', () => {
    albums$.error(new Error('rtdb down'));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.skeleton-tile').length).toBe(0);
    expect(el.querySelector('app-load-error')).not.toBeNull();

    // The errored stream is terminal; hand retry a live one, as the real
    // service would after its internal refetch.
    albums$ = new Subject();
    component.onRetry();
    albums$.next([{ id: 'a1', title: 'E2E Album One', updatedAt: 1 } as PhotoAlbum]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-load-error')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.album-tile').length).toBe(1);
  });
});
