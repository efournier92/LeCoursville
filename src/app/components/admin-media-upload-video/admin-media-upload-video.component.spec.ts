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

  const media = { id: 'v1', title: 'Reunion', fileName: 'reunion.mp4' } as UploadableMedia;

  beforeEach(async () => {
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));
    deleteMedia = jasmine.createSpy('deleteMedia');

    await TestBed.configureTestingModule({
      declarations: [ AdminMediaUploadVideoComponent ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthService,
          useValue: { userObservable: of({ roles: { user: true, admin: false, super: true } }) },
        },
        { provide: VideoUploadService, useValue: { upload: jasmine.createSpy('upload') } },
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

  it('keeps the selection and shows an alert when the delete fails', async () => {
    confirmSpy.and.returnValue(Promise.resolve(true));
    deleteMedia.and.returnValue(Promise.reject(new Error('denied')));
    component.onMediaSelect(media as any);

    await component.onDeleteSelectedMedia(media);
    fixture.detectChanges();

    expect(component.video.id).toBe('v1');
    expect(fixture.nativeElement.querySelector('.action-error').textContent).toContain('Couldn');
  });
});
