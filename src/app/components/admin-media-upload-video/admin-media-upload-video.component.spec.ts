import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { AdminMediaUploadVideoComponent } from './admin-media-upload-video.component';
import { AuthService } from 'src/app/services/auth.service';
import { CloudFunctionsService } from 'src/app/services/cloud-functions.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import {
  ClientMediaUploadTicket,
  MediaUploadService,
  UploadProgress,
} from 'src/app/services/media-upload.service';
import { Video } from 'src/app/models/media/video';

const DUPLICATE =
  'A record named "Video/my-trip.mp4" already exists. Delete it or choose a different name.';
const BATCH = 'batch-1';
const RESUME_FILE_MESSAGE =
  'Choose the missing MP4 file, then choose Resume upload.';

function mp4(name = 'My-Trip_2026.mp4', size = 10): File {
  return new File([new Uint8Array(size)], name, { type: 'video/mp4' });
}

function jpeg(): Blob {
  return new Blob(['jpeg'], { type: 'image/jpeg' });
}

function ticket(role: 'video' | 'thumbnail' = 'video'): ClientMediaUploadTicket {
  return {
    role,
    key: role === 'video' ? 'Video/my-trip.mp4' : 'Video/Icons/my-trip.jpg',
    mode: 'single',
    url: `https://s3.example/${role}`,
    method: 'PUT',
    headers: {},
    expiresAt: Date.now() + 900000,
    batchId: BATCH,
  };
}

function record(overrides: Partial<Video> = {}): Video {
  const video = new Video();
  video.id = 'v1';
  video.title = 'Old';
  video.date = '2020';
  video.duration = '3:45';
  video.fileName = 'old.mp4';
  video.urls = { download: '', icon: '' };
  video.storage = {
    managed: true,
    key: 'Video/old.mp4',
    iconKey: 'Video/Icons/old.jpg',
    batchId: 'old-batch',
  };
  return Object.assign(video, overrides);
}

async function flushMicrotasks(times = 12): Promise<void> {
  for (let index = 0; index < times; index++) {
    await Promise.resolve();
  }
}

describe('AdminMediaUploadVideoComponent', () => {
  let component: AdminMediaUploadVideoComponent;
  let fixture: ComponentFixture<AdminMediaUploadVideoComponent>;
  let mediaUpload: MediaUploadService;
  let cloud: Record<string, ReturnType<typeof vi.fn>>;
  let confirm: ReturnType<typeof vi.fn>;
  let createObjectUrl: unknown;
  let revokeObjectUrl: unknown;

  beforeEach(async () => {
    sessionStorage.clear();
    createObjectUrl = (URL as any).createObjectURL;
    revokeObjectUrl = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn(() => 'blob:preview');
    (URL as any).revokeObjectURL = vi.fn();

    cloud = {
      createMediaUpload: vi.fn().mockResolvedValue({
        batchId: BATCH,
        keys: { video: { key: 'Video/server-x.mp4', iconKey: 'Video/Icons/server-x.jpg' } },
        firstAsset: { role: 'video' },
      }),
      resumeMediaUpload: vi.fn().mockResolvedValue({ uploads: [ticket()] }),
      finalizeMediaUpload: vi.fn().mockResolvedValue({ id: 'media-1', record: {} }),
      updateMediaMetadata: vi.fn().mockResolvedValue({ record: {} }),
      deleteMedia: vi.fn().mockResolvedValue({ id: 'v1', objectsDeleted: 1 }),
    };
    confirm = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      declarations: [AdminMediaUploadVideoComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: { userObservable: of({ id: 'u1', roles: { admin: true } }) },
        },
        { provide: CloudFunctionsService, useValue: cloud },
        { provide: ConfirmDialogService, useValue: { confirm } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMediaUploadVideoComponent);
    component = fixture.componentInstance;
    mediaUpload = TestBed.inject(MediaUploadService);
    vi.spyOn(mediaUpload, 'putSingle').mockReturnValue(
      of<UploadProgress>({ loaded: 10, total: 10, percent: 100 }),
    );
    vi.spyOn(mediaUpload, 'putParts').mockReturnValue(
      of<UploadProgress>({ loaded: 10, total: 10, percent: 100 }),
    );
    fixture.detectChanges();
  });

  afterEach(() => {
    (URL as any).createObjectURL = createObjectUrl;
    (URL as any).revokeObjectURL = revokeObjectUrl;
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  function readyToUpload(): void {
    component.selectedVideoFile = mp4();
    component.video.title = 'My Trip';
    component.video.date = '2026';
    component.storageName = 'my-trip';
    (component as any).thumbnailBlob = jpeg();
  }

  it('creates and defaults the date to the current year', () => {
    expect(component).toBeTruthy();
    expect(component.video.date).toBe(String(new Date().getFullYear()));
  });

  it('validates every message and preserves the form state', async () => {
    component.video.title = 'Keep me';
    component.video.date = '2026';
    component.storageName = 'keep-me';

    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Choose an MP4 file.');
    expect(component.video.title).toBe('Keep me');

    component.selectedVideoFile = mp4();
    component.video.title = '';
    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Enter the title before uploading.');

    component.video.title = 'Keep me';
    component.video.date = '';
    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Enter the date before uploading.');

    component.video.date = '2026';
    component.storageName = '';
    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Enter a storage name.');

    component.storageName = 'Not Valid';
    await component.onUploadSelectedMedia();
    expect(component.formError).toBe(
      'Use only lowercase letters, numbers, and single dashes in the storage name.',
    );

    component.storageName = 'keep-me';
    (component as any).thumbnailBlob = null;
    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Choose a thumbnail image.');
    expect(component.video.title).toBe('Keep me');
  });

  it('rejects a non-MP4 file and a file larger than 2 GB', async () => {
    await component.onVideoFileSelected(
      new File(['x'], 'fixture.wav', { type: 'audio/wav' }),
    );
    expect(component.formError).toBe('Choose an MP4 file.');

    const huge = { name: 'huge.mp4', type: 'video/mp4', size: 2147483649 } as File;
    await component.onVideoFileSelected(huge);
    expect(component.formError).toBe('That file is larger than 2 GB.');
  });

  it('prefills the title and the storage name from the dropped filename', async () => {
    vi.spyOn(component as any, 'loadSelectedVideo').mockResolvedValue(undefined);

    await component.onVideoFileSelected(mp4('My-Trip_2026.mp4'));

    expect(component.video.title).toBe('My Trip 2026');
    expect(component.storageName).toBe('my-trip-2026');
    expect(component.video.date).toBe(String(new Date().getFullYear()));

    component.video.title = 'Custom title';
    await component.onVideoFileSelected(mp4('another-file.mp4'));
    expect(component.video.title).toBe('Custom title');
  });

  it('populates the preview after a successful frame capture', async () => {
    const blob = jpeg();
    vi.spyOn(component as any, 'createVideoElement').mockResolvedValue({
      duration: 100,
      videoWidth: 1280,
      videoHeight: 720,
    });
    vi.spyOn(component as any, 'captureInitialFrame').mockResolvedValue(blob);

    await component.onVideoFileSelected(mp4());

    expect(component.thumbnailBlob).toBe(blob);
    expect(component.thumbnailPreviewUrl).toBeTruthy();
    expect(component.video.duration).toBe('1:40');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="video-thumbnail-preview"]'),
    ).not.toBeNull();
  });

  it('requires the manual override when frame capture fails', async () => {
    vi.spyOn(component as any, 'createVideoElement').mockResolvedValue({
      duration: Number.NaN,
      videoWidth: 0,
      videoHeight: 0,
    });

    await component.onVideoFileSelected(mp4());

    expect(component.captureFailed).toBe(true);
    expect(component.formError).toBe(
      'Automatic thumbnail failed. Choose a thumbnail image.',
    );

    component.video.title = 'My Trip';
    component.storageName = 'my-trip';
    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Choose a thumbnail image.');
  });

  it('switches the path preview from provisional to the ticket keys', async () => {
    readyToUpload();
    component.storageName = 'my-trip';
    cloud.finalizeMediaUpload.mockRejectedValueOnce({
      code: 'functions/unavailable',
      message: 'down',
    });

    await component.onUploadSelectedMedia();

    expect(component.pathProvisional).toBe(false);
    expect(component.previewVideoKey()).toBe('Video/server-x.mp4');
    expect(component.previewIconKey()).toBe('Video/Icons/server-x.jpg');
    fixture.detectChanges();
    const preview = fixture.nativeElement.querySelector(
      '[data-testid="video-path-preview"]',
    );
    expect(preview.textContent).toContain('Video/server-x.mp4');
    expect(preview.getAttribute('data-provisional')).toBeNull();
  });

  it('resets the form and clears the session-storage batch after success', async () => {
    readyToUpload();

    await component.onUploadSelectedMedia();

    expect(component.uploadSuccess).toBe('Saved "My Trip".');
    expect(component.video.title).toBe('');
    expect(component.storageName).toBe('');
    expect(component.thumbnailBlob).toBeNull();
    expect(component.pathProvisional).toBe(true);
    expect(sessionStorage.getItem(`mediaUploadBatch:${BATCH}`)).toBeNull();
  });

  it('keeps the form and shows the duplicate message', async () => {
    readyToUpload();
    cloud.createMediaUpload.mockRejectedValueOnce({
      code: 'functions/already-exists',
      message: DUPLICATE,
    });

    await component.onUploadSelectedMedia();

    expect(component.formError).toBe(DUPLICATE);
    expect(component.video.title).toBe('My Trip');
    expect(component.storageName).toBe('my-trip');
    expect(component.uploadSuccess).toBeNull();
  });

  it('keeps the retry path and message after a finalize failure', async () => {
    readyToUpload();
    cloud.finalizeMediaUpload.mockRejectedValueOnce({
      code: 'functions/unavailable',
      message: 'down',
    });

    await component.onUploadSelectedMedia();

    expect(component.finalizeFailed).toBe(true);
    expect(component.formError).toBe(
      'The file uploaded but the record could not be saved. Choose Retry to finish saving.',
    );
    expect(component.video.title).toBe('My Trip');

    await component.onRetryFinalize();
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledTimes(2);
    expect(cloud.createMediaUpload).toHaveBeenCalledTimes(1);
    expect(component.uploadSuccess).toBe('Saved "My Trip".');
  });

  it('hides file controls in edit mode and saves duration through the callable', async () => {
    component.onMediaSelect(record());
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="video-file-input"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('input[name="videoStorageName"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="video-thumbnail-input"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('mat-checkbox[name="replaceVideoFile"]'),
    ).not.toBeNull();

    component.video.title = 'New title';
    component.video.duration = '4:00';
    await component.onUploadSelectedMedia();

    expect(cloud.createMediaUpload).not.toHaveBeenCalled();
    expect(cloud.updateMediaMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'v1',
        title: 'New title',
        duration: '4:00',
      }),
    );
    expect(component.uploadSuccess).toBe('Saved "New title".');
  });

  it('replaces a file without a thumbnail and keeps the storage name', async () => {
    component.onMediaSelect(record());
    component.replaceFile = true;
    vi.spyOn(component as any, 'loadSelectedVideo').mockResolvedValue(undefined);

    await component.onVideoFileSelected(mp4('new-file.mp4'));
    await component.onUploadSelectedMedia();

    const request = cloud.createMediaUpload.mock.calls[0][0];
    expect(request.kind).toBe('video');
    expect(request.mode).toBe('replace');
    expect(request.mediaId).toBe('v1');
    expect(request.video.storageName).toBe('old');
    expect('thumbnail' in request.video).toBe(false);
    expect(cloud.resumeMediaUpload).toHaveBeenCalledTimes(1);
    expect(cloud.resumeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'video' }),
    );
  });

  it('cancels the batch when an upload is canceled', async () => {
    readyToUpload();
    vi.spyOn(mediaUpload, 'putSingle').mockReturnValue(
      new Observable<UploadProgress>(() => {}),
    );
    const upload = component.onUploadSelectedMedia();
    await flushMicrotasks();
    expect(component.batchId).toBe(BATCH);

    await component.onCancelUpload();

    expect(cloud.deleteMedia).toHaveBeenCalledWith({ batchId: BATCH });
    expect(component.uploading).toBe(false);
    void upload;
  });

  it('reports the nothing-removed message when object deletion fails', async () => {
    component.onMediaSelect(record());
    cloud.deleteMedia.mockRejectedValueOnce({
      code: 'functions/failed-precondition',
      message: 'Could not delete "Video/old.mp4". Retry the delete.',
    });

    await component.onDeleteSelectedMedia(component.video);

    expect(component.deleteError).toBe(
      'Could not delete "Old". Nothing was removed. Retry the delete.',
    );
    expect(component.video.id).toBe('v1');
    expect(component.uploadSuccess).toBeNull();
  });

  it('reports success after a managed delete', async () => {
    component.onMediaSelect(record());

    await component.onDeleteSelectedMedia(component.video);

    expect(cloud.deleteMedia).toHaveBeenCalledWith({ mediaId: 'v1' });
    expect(component.uploadSuccess).toBe('Deleted "Old".');
  });

  it('offers Resume upload for a session-storage batch', async () => {
    sessionStorage.setItem(
      `mediaUploadBatch:resume-1`,
      JSON.stringify({
        batchId: 'resume-1',
        kind: 'video',
        mode: 'create',
        storageName: 'resume-video',
        folderName: '',
        createdAt: Date.now(),
      }),
    );
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.resumeBatch?.batchId).toBe('resume-1');
    expect(
      fixture.nativeElement.querySelector('.admin-form-action-button-resume')
        .textContent,
    ).toContain('Resume upload');

    await component.onResumeUpload();
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: 'resume-1' }),
    );
    expect(component.uploadSuccess).toContain('Saved');
  });

  it('persists and restores the typed video metadata for a pending batch', async () => {
    readyToUpload();
    component.video.isSticky = true;
    component.video.isHidden = true;
    component.video.duration = '1:40';
    cloud.finalizeMediaUpload.mockRejectedValueOnce({
      code: 'functions/unavailable',
      message: 'down',
    });

    await component.onUploadSelectedMedia();

    const stored = JSON.parse(sessionStorage.getItem(`mediaUploadBatch:${BATCH}`) as string);
    expect(stored).toMatchObject({
      batchId: BATCH,
      kind: 'video',
      mode: 'create',
      storageName: 'my-trip',
      metadata: {
        title: 'My Trip',
        date: '2026',
        isSticky: true,
        isHidden: true,
        duration: '1:40',
      },
    });

    component.ngOnInit();

    expect(component.video.title).toBe('My Trip');
    expect(component.video.date).toBe('2026');
    expect(component.video.duration).toBe('1:40');
    expect(component.storageName).toBe('my-trip');
  });

  it('finalizes a resumed video with the typed title and date, not the slug and current year', async () => {
    sessionStorage.setItem(
      'mediaUploadBatch:resume-meta',
      JSON.stringify({
        batchId: 'resume-meta',
        kind: 'video',
        mode: 'create',
        storageName: 'resume-video',
        folderName: '',
        createdAt: Date.now(),
        metadata: {
          title: 'Typed Title',
          date: '1999',
          isSticky: false,
          isHidden: false,
          duration: '2:05',
        },
      }),
    );
    component.ngOnInit();

    await component.onResumeUpload();

    expect(cloud.finalizeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'resume-meta',
        metadata: expect.objectContaining({
          title: 'Typed Title',
          date: '1999',
          duration: '2:05',
        }),
      }),
    );
    expect(component.uploadSuccess).toBe('Saved "Typed Title".');
  });

  it('asks for the missing file, uploads it on the same batch, and never creates a new one', async () => {
    const batch = {
      batchId: 'resume-missing',
      kind: 'video',
      mode: 'create',
      storageName: 'resume-video',
      folderName: '',
      createdAt: Date.now(),
      metadata: {
        title: 'Typed Title',
        date: '1999',
        isSticky: false,
        isHidden: false,
        duration: '2:05',
      },
    };
    sessionStorage.setItem('mediaUploadBatch:resume-missing', JSON.stringify(batch));
    component.ngOnInit();
    const missing = {
      code: 'functions/failed-precondition',
      message:
        'Upload not found or invalid for "Video/resume-video.mp4". Upload the file again.',
    };
    cloud.finalizeMediaUpload
      .mockRejectedValueOnce(missing)
      .mockRejectedValueOnce(missing);

    await component.onResumeUpload();

    expect(component.formError).toBe(RESUME_FILE_MESSAGE);
    expect(component.resumeBatch?.batchId).toBe('resume-missing');
    expect(cloud.createMediaUpload).not.toHaveBeenCalled();

    vi.spyOn(component as any, 'loadSelectedVideo').mockResolvedValue(undefined);
    await component.onVideoFileSelected(mp4('resume-video.mp4'));

    expect(component.storageName).toBe('resume-video');

    await component.onUploadSelectedMedia();

    expect(cloud.createMediaUpload).not.toHaveBeenCalled();
    expect(cloud.resumeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: 'resume-missing', role: 'video' }),
    );
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledTimes(3);
    expect(component.uploadSuccess).toBe('Saved "Typed Title".');
  });

  it('keeps the batch and offers Resume after an upload-stage failure', async () => {
    readyToUpload();
    cloud.resumeMediaUpload.mockRejectedValueOnce({
      code: 'functions/unavailable',
      message: 'down',
    });

    await component.onUploadSelectedMedia();

    expect(cloud.createMediaUpload).toHaveBeenCalledTimes(1);
    expect(component.resumeBatch?.batchId).toBe(BATCH);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.admin-form-action-button-resume'),
    ).not.toBeNull();

    await component.onUploadSelectedMedia();

    expect(cloud.createMediaUpload).toHaveBeenCalledTimes(1);
    expect(component.uploadSuccess).toBe('Saved "My Trip".');
  });

  it('shows existing keys for managed records and hides the path for legacy records', () => {
    component.onMediaSelect(record());
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector(
      '[data-testid="video-path-preview"]',
    );
    expect(preview).not.toBeNull();
    expect(preview.textContent).toContain('Video/old.mp4');
    expect(preview.textContent).toContain('Video/Icons/old.jpg');

    const legacy = new Video();
    legacy.id = 'v2';
    legacy.title = 'Legacy';
    legacy.fileName = 'legacy.mp4';
    legacy.urls = { download: 'https://drive.google.com/file', icon: '' };
    component.onMediaSelect(legacy);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="video-path-preview"]'),
    ).toBeNull();
  });

  it('labels every control and exposes live progress and error regions', () => {
    const element = fixture.nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('mat-label')).map(label =>
      label.textContent.trim(),
    );
    expect(labels).toContain('Title');
    expect(labels).toContain('Date');
    expect(labels).toContain('Storage name');
    expect(element.querySelector('label[for="videoFileInput"]')).not.toBeNull();
    expect(
      element.querySelector('label[for="videoThumbnailTime"]').textContent,
    ).toContain('Thumbnail frame');
    expect(
      element.querySelector('label[for="videoThumbnailInput"]').textContent,
    ).toContain('Choose thumbnail image');
    expect(
      element.querySelector('[data-testid="video-upload-progress"]').getAttribute('role'),
    ).toBe('status');

    component.formError = 'Choose an MP4 file.';
    fixture.detectChanges();
    expect(
      element
        .querySelector('[data-testid="video-upload-error"]')
        .getAttribute('role'),
    ).toBe('alert');
  });
});
