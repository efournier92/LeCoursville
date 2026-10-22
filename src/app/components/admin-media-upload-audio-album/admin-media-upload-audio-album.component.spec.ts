import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { of } from 'rxjs';

import { AdminMediaUploadAudioAlbumComponent } from './admin-media-upload-audio-album.component';
import { AuthService } from 'src/app/services/auth.service';
import { AudioAlbumUploadService } from 'src/app/services/audio-album-upload.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { MediaService } from 'src/app/services/media.service';
import { UploadableMedia } from 'src/app/models/media/media';

describe('AdminMediaUploadAudioAlbumComponent', () => {
  let component: AdminMediaUploadAudioAlbumComponent;
  let fixture: ComponentFixture<AdminMediaUploadAudioAlbumComponent>;
  let confirmSpy: jasmine.Spy;
  let deleteMedia: jasmine.Spy;
  let uploadAlbum: jasmine.Spy;

  const media = { id: 'a1', title: 'Reunion', folderName: 'reunion' } as UploadableMedia;

  beforeEach(async () => {
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));
    deleteMedia = jasmine.createSpy('deleteMedia');
    uploadAlbum = jasmine.createSpy('upload').and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      declarations: [ AdminMediaUploadAudioAlbumComponent ],
      imports: [ TextFieldModule ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthService,
          useValue: { userObservable: of({ roles: { user: true, admin: false, super: true } }) },
        },
        { provide: AudioAlbumUploadService, useValue: { upload: uploadAlbum } },
        { provide: MediaService, useValue: { deleteMedia } },
        { provide: ConfirmDialogService, useValue: { confirm: confirmSpy } },
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminMediaUploadAudioAlbumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('treats a super role as sufficient without the admin flag', () => {
    expect(component.isUserAdmin()).toBe(true);
    expect(fixture.nativeElement.querySelector('.audio-album-upload-form')).not.toBeNull();
  });

  it('does not delete the album when the confirmation is cancelled', async () => {
    await component.onDeleteSelectedMedia(media);
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteMedia).not.toHaveBeenCalled();
  });

  it('deletes the album after a destructive confirmation', async () => {
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onDeleteSelectedMedia(media);
    expect(deleteMedia).toHaveBeenCalledWith(media);
  });

  it('shows inline validation and keeps the form when the folder is missing', async () => {
    component.album.title = 'Reunion';

    await component.onUploadSelectedMedia();
    fixture.detectChanges();

    expect(uploadAlbum).not.toHaveBeenCalled();
    expect(component.formError).toContain('folder name');
    expect(component.album.title).toBe('Reunion');
  });

  it('keeps the form and shows an error when the upload fails', async () => {
    uploadAlbum.and.returnValue(Promise.reject(new Error('denied')));
    component.album.title = 'Reunion';
    component.album.folderName = 'reunion';

    await component.onUploadSelectedMedia();
    fixture.detectChanges();

    expect(component.uploading).toBe(false);
    expect(component.album.title).toBe('Reunion');
    expect(fixture.nativeElement.querySelector('[data-testid="album-upload-error"]').textContent).toContain('Couldn');
  });

  it('clears the form and confirms success after the upload resolves', async () => {
    component.album.title = 'Reunion';
    component.album.folderName = 'reunion';

    await component.onUploadSelectedMedia();
    fixture.detectChanges();

    expect(component.album.title).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[data-testid="album-upload-success"]').textContent).toContain('Saved');
  });

  it('keeps the selection and shows an alert when the delete fails', async () => {
    confirmSpy.and.returnValue(Promise.resolve(true));
    deleteMedia.and.returnValue(Promise.reject(new Error('denied')));
    component.onMediaSelect(media as any);

    await component.onDeleteSelectedMedia(media);
    fixture.detectChanges();

    expect(component.album.id).toBe('a1');
    expect(fixture.nativeElement.querySelector('.admin-error').textContent).toContain('Couldn');
  });
});
