import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject, of } from 'rxjs';

import { AdminPhotoAlbumsComponent } from './admin-photo-albums.component';
import { PhotoAlbumsService } from 'src/app/services/photo-albums.service';
import { PhotosService } from 'src/app/services/photos.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { MatDialog } from '@angular/material/dialog';
import { PhotoAlbum } from 'src/app/models/photo-album';
import { Photo } from 'src/app/models/photo';

describe('AdminPhotoAlbumsComponent', () => {
  let fixture: ComponentFixture<AdminPhotoAlbumsComponent>;
  let component: AdminPhotoAlbumsComponent;
  let albums$: Subject<PhotoAlbum[] | null>;
  let albumsError$: Subject<boolean>;
  let photos$: Subject<Photo[]>;
  let confirmSpy: jasmine.Spy;
  let deleteAlbumCascade: jasmine.Spy;
  let deletePhoto: jasmine.Spy;
  let updateAlbum: jasmine.Spy;
  let setAlbumCover: jasmine.Spy;
  let getPhotosByAlbum: jasmine.Spy;
  let reload: jasmine.Spy;

  const album = (id: string, title: string): PhotoAlbum => ({
    id,
    title,
    coverPhotoId: null,
    createdAt: 1,
    updatedAt: 1,
  });

  beforeEach(async () => {
    albums$ = new Subject<PhotoAlbum[] | null>();
    albumsError$ = new Subject<boolean>();
    photos$ = new Subject<Photo[]>();
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));
    deleteAlbumCascade = jasmine.createSpy('deleteAlbumCascade').and.returnValue(Promise.resolve());
    deletePhoto = jasmine.createSpy('deletePhoto').and.returnValue(Promise.resolve());
    updateAlbum = jasmine.createSpy('updateAlbum').and.returnValue(Promise.resolve());
    setAlbumCover = jasmine.createSpy('setAlbumCover').and.returnValue(Promise.resolve());
    getPhotosByAlbum = jasmine.createSpy('getPhotosByAlbum').and.returnValue(of([]));
    reload = jasmine.createSpy('reload');

    await TestBed.configureTestingModule({
      imports: [AdminPhotoAlbumsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: PhotoAlbumsService,
          useValue: {
            get albums$() { return albums$.asObservable(); },
            error$: albumsError$.asObservable(),
            reload,
            createAlbum: jasmine.createSpy('createAlbum'),
            updateAlbum,
            deleteAlbumCascade,
          },
        },
        {
          provide: PhotosService,
          useValue: {
            nonMessagePhotos$: photos$.asObservable(),
            getPhotosByAlbum,
            deletePhoto,
            setAlbumCover,
            uploadPhotoToAlbum: jasmine.createSpy('uploadPhotoToAlbum'),
          },
        },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: ConfirmDialogService, useValue: { confirm: confirmSpy } },
        { provide: AnalyticsService, useValue: { logEvent: jasmine.createSpy('logEvent') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPhotoAlbumsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows a skeleton until the first album snapshot', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(component.status).toBe('loading');
    expect(el.querySelectorAll('.album-skeleton').length).toBe(6);
    expect(el.querySelector('app-load-error')).toBeNull();
  });

  it('shows the empty state for an empty album snapshot', () => {
    albums$.next([]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(component.status).toBe('ready');
    expect(el.querySelectorAll('.album-skeleton').length).toBe(0);
    expect(el.querySelector('app-no-results-message')).not.toBeNull();
  });

  it('shows an error with a retry when the album stream fails', () => {
    albums$.error(new Error('rtdb down'));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(component.status).toBe('error');
    expect(el.querySelectorAll('.album-skeleton').length).toBe(0);
    expect(el.querySelector('app-load-error')).not.toBeNull();
  });

  it('renders the album cards once a populated snapshot arrives', () => {
    albums$.next([album('a1', 'E2E Album One')]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.admin-album-card').length).toBe(1);
    expect(el.textContent).toContain('E2E Album One');
  });

  it('paginates albums at 12 per page', () => {
    albums$.next(Array.from({ length: 13 }, (_, i) => album(`a${i}`, `Album ${i}`)));
    fixture.detectChanges();
    expect(component.pageData.items.length).toBe(12);
    expect(component.pageData.pageCount).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.admin-album-card').length).toBe(12);

    component.nextPage();
    fixture.detectChanges();
    expect(component.pageData.items.length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.admin-album-card').length).toBe(1);
  });

  it('resets to page 1 when the search changes', () => {
    albums$.next(Array.from({ length: 13 }, (_, i) => album(`a${i}`, `Album ${i}`)));
    fixture.detectChanges();
    component.nextPage();
    component.onSearchChange('Album');
    expect(component.page).toBe(1);
  });

  it('does not delete an album when the confirmation is cancelled', async () => {
    const target = album('a1', 'E2E Album One');
    albums$.next([target]);
    fixture.detectChanges();

    await component.onDeleteAlbum(target);
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteAlbumCascade).not.toHaveBeenCalled();
  });

  it('deletes the album when the confirmation is accepted', async () => {
    const target = album('a1', 'E2E Album One');
    albums$.next([target]);
    fixture.detectChanges();
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onDeleteAlbum(target);
    expect(deleteAlbumCascade).toHaveBeenCalledWith('a1', []);
  });

  it('does not delete a photo when the confirmation is cancelled', async () => {
    const target = album('a1', 'E2E Album One');
    component.selectedAlbum = target;
    const photo = { id: 'p1', albumId: 'a1', info: 'A photo' } as Photo;

    await component.onDeletePhoto(photo);
    expect(confirmSpy).toHaveBeenCalled();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('deletes a photo when the confirmation is accepted', async () => {
    const target = album('a1', 'E2E Album One');
    component.selectedAlbum = target;
    const photo = { id: 'p1', albumId: 'a1', info: 'A photo' } as Photo;
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onDeletePhoto(photo);
    expect(deletePhoto).toHaveBeenCalledWith(photo);
    expect(updateAlbum).toHaveBeenCalledWith('a1', {});
  });

  it('shows an error when the album error signal fires', () => {
    albumsError$.next(true);
    fixture.detectChanges();
    expect(component.status).toBe('error');
    expect(fixture.nativeElement.querySelector('app-load-error')).not.toBeNull();
  });

  it('reloads the album stream on retry', () => {
    albumsError$.next(true);
    fixture.detectChanges();

    component.onRetry();
    expect(reload).toHaveBeenCalled();
    expect(component.status).toBe('loading');
  });

  it('keeps the drill-in state and shows a page error when the cascade fails', async () => {
    const target = album('a1', 'E2E Album One');
    albums$.next([target]);
    fixture.detectChanges();
    component.selectedAlbum = target;
    confirmSpy.and.returnValue(Promise.resolve(true));
    deleteAlbumCascade.and.returnValue(Promise.reject(new Error('denied')));

    await component.onDeleteAlbum(target);

    expect(component.actionError).toContain('Couldn');
    expect(component.selectedAlbum).toBe(target);
    expect(component.isDeletingAlbum).toBe(false);
  });

  it('refuses to delete an album when the photo list failed to load', async () => {
    const target = album('a1', 'E2E Album One');
    albums$.next([target]);
    fixture.detectChanges();
    photos$.error(new Error('photos down'));
    fixture.detectChanges();
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onDeleteAlbum(target);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deleteAlbumCascade).not.toHaveBeenCalled();
    expect(component.actionError).toContain('Couldn');
    expect(fixture.nativeElement.querySelector('.action-error')).not.toBeNull();
  });

  it('ignores stale photo emissions after opening another album', () => {
    const first = new Subject<Photo[]>();
    const second = new Subject<Photo[]>();
    getPhotosByAlbum.and.returnValues(first.asObservable(), second.asObservable());

    component.openAlbumPhotos(album('a1', 'Album One'));
    component.openAlbumPhotos(album('a2', 'Album Two'));
    first.next([{ id: 'p1', albumId: 'a1' } as Photo]);
    expect(component.selectedAlbumPhotos).toEqual([]);

    second.next([{ id: 'p2', albumId: 'a2' } as Photo]);
    expect(component.selectedAlbumPhotos.length).toBe(1);
  });
});
