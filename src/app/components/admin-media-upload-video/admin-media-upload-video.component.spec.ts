import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { AdminMediaUploadVideoComponent } from './admin-media-upload-video.component';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { MediaService } from 'src/app/services/media.service';
import { VideoUploadService } from 'src/app/services/video-upload.service';
import { UploadableMedia } from 'src/app/models/media/media';

describe('AdminMediaUploadVideoComponent', () => {
  let component: AdminMediaUploadVideoComponent;
  let fixture: ComponentFixture<AdminMediaUploadVideoComponent>;
  let confirmSpy: jasmine.Spy;
  let deleteMedia: jasmine.Spy;
  let uploadVideo: jasmine.Spy;

  const media = { id: 'v1', title: 'Reunion', fileName: 'reunion.mp4' } as UploadableMedia;

  beforeEach(async () => {
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));
    deleteMedia = jasmine.createSpy('deleteMedia');
    uploadVideo = jasmine.createSpy('upload').and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      declarations: [ AdminMediaUploadVideoComponent ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthService,
          useValue: { userObservable: of({ roles: { user: true, admin: false, super: true } }) },
        },
        { provide: VideoUploadService, useValue: { upload: uploadVideo } },
        { provide: MediaService, useValue: { deleteMedia } },
        { provide: ConfirmDialogService, useValue: { confirm: confirmSpy } },
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminMediaUploadVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the form for a super without the admin flag', () => {
    expect(fixture.nativeElement.querySelector('.admin-media-upload-upload-form')).not.toBeNull();
  });

  it('does not delete the video when the confirmation is cancelled', async () => {
    await component.onDeleteSelectedMedia(media);
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteMedia).not.toHaveBeenCalled();
  });

  it('deletes the video after a destructive confirmation', async () => {
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onDeleteSelectedMedia(media);
    expect(deleteMedia).toHaveBeenCalledWith(media);
  });

  it('shows inline validation and keeps the form when required fields are missing', async () => {
    component.video.title = 'Reunion';
    component.video.fileName = 'reunion.mp4';

    await component.onUploadSelectedMedia();
    fixture.detectChanges();

    expect(uploadVideo).not.toHaveBeenCalled();
    expect(component.formError).toContain('date');
    expect(component.video.title).toBe('Reunion');
    expect(fixture.nativeElement.querySelector('[data-testid="video-upload-error"]').textContent).toContain('date');
  });

  it('keeps the form and shows an error when the upload fails', async () => {
    uploadVideo.and.returnValue(Promise.reject(new Error('denied')));
    component.video.title = 'Reunion';
    component.video.fileName = 'reunion.mp4';
    component.video.date = '2026';

    await component.onUploadSelectedMedia();
    fixture.detectChanges();

    expect(component.uploading).toBe(false);
    expect(component.video.title).toBe('Reunion');
    expect(fixture.nativeElement.querySelector('[data-testid="video-upload-error"]').textContent).toContain('Couldn');
  });

  it('clears the form and confirms success after the upload resolves', async () => {
    component.video.title = 'Reunion';
    component.video.fileName = 'reunion.mp4';
    component.video.date = '2026';

    await component.onUploadSelectedMedia();
    fixture.detectChanges();

    expect(component.video.title).toBe('');
    expect(fixture.nativeElement.querySelector('[data-testid="video-upload-success"]').textContent).toContain('Saved');
  });

  it('keeps the selection and shows an alert when the delete fails', async () => {
    confirmSpy.and.returnValue(Promise.resolve(true));
    deleteMedia.and.returnValue(Promise.reject(new Error('denied')));
    component.onMediaSelect(media as any);

    await component.onDeleteSelectedMedia(media);
    fixture.detectChanges();

    expect(component.video.id).toBe('v1');
    expect(fixture.nativeElement.querySelector('.admin-error').textContent).toContain('Couldn');
  });
});
