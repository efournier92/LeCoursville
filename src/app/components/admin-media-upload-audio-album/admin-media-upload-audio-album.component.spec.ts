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

  const media = { id: 'a1', title: 'Reunion', folderName: 'reunion' } as UploadableMedia;

  beforeEach(async () => {
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));
    deleteMedia = jasmine.createSpy('deleteMedia');

    await TestBed.configureTestingModule({
      declarations: [ AdminMediaUploadAudioAlbumComponent ],
      imports: [ TextFieldModule ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthService,
          useValue: { userObservable: of({ roles: { user: true, admin: false, super: true } }) },
        },
        { provide: AudioAlbumUploadService, useValue: { upload: jasmine.createSpy('upload') } },
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
