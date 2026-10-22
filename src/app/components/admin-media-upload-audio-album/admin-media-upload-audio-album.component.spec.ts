import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AdminMediaUploadAudioAlbumComponent } from './admin-media-upload-audio-album.component';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { AuthService } from 'src/app/services/auth.service';
import { CloudFunctionsService } from 'src/app/services/cloud-functions.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { MediaService } from 'src/app/services/media.service';
import {
  ClientMediaUploadTicket,
  MediaUploadService,
  UploadProgress,
} from 'src/app/services/media-upload.service';
import { ALBUM_ZIP_ERROR } from 'src/app/services/media/album-zip';

const BATCH = 'album-batch';
const FOLDER_DUPLICATE =
  'A folder named "Le+Cours" already exists. Delete the existing album or choose a different folder name.';
const RESUME_FILES_MESSAGE =
  'Some album files are missing. Select the tracks again, then choose Resume upload.';

function mp3(name = '01 - First.mp3', size = 10): File {
  return new File([new Uint8Array(size)], name, { type: 'audio/mpeg' });
}

function fakeMp3(name: string, size: number): File {
  return { name, type: 'audio/mpeg', size } as File;
}

function jpeg(): Blob {
  return new Blob(['jpeg'], { type: 'image/jpeg' });
}

function zipBlob(): Blob {
  return new Blob(['zip'], { type: 'application/zip' });
}

function ticket(role: string, trackIndex?: number): ClientMediaUploadTicket {
  return {
    role: role as ClientMediaUploadTicket['role'],
    ...(trackIndex !== undefined ? { trackIndex } : {}),
    key: `Music/Albums/Le+Cours/${role}${trackIndex ?? ''}`,
    mode: 'single',
    url: `https://s3.example/${role}`,
    method: 'PUT',
    headers: {},
    expiresAt: Date.now() + 900000,
    batchId: BATCH,
  };
}

async function flushMicrotasks(times = 12): Promise<void> {
  for (let index = 0; index < times; index++) {
    await Promise.resolve();
  }
}

describe('AdminMediaUploadAudioAlbumComponent', () => {
  let component: AdminMediaUploadAudioAlbumComponent;
  let fixture: ComponentFixture<AdminMediaUploadAudioAlbumComponent>;
  let mediaUpload: MediaUploadService;
  let cloud: Record<string, ReturnType<typeof vi.fn>>;
  let mediaService: { getMediaById: ReturnType<typeof vi.fn> };
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
        keys: { album: { folder: 'Le+Cours', coverKey: '', zipKey: '', tracks: [] } },
        firstAsset: { role: 'track', trackIndex: 0 },
      }),
      resumeMediaUpload: vi.fn().mockImplementation((input: any) =>
        Promise.resolve({ uploads: [ticket(input.role, input.trackIndex)] }),
      ),
      finalizeMediaUpload: vi.fn().mockResolvedValue({ id: 'album-1', record: {} }),
      updateMediaMetadata: vi.fn().mockResolvedValue({ record: {} }),
      deleteMedia: vi.fn().mockResolvedValue({ id: 'a1', objectsDeleted: 1 }),
    };
    confirm = vi.fn().mockResolvedValue(true);
    mediaService = { getMediaById: vi.fn().mockReturnValue(undefined) };

    await TestBed.configureTestingModule({
      declarations: [AdminMediaUploadAudioAlbumComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: { userObservable: of({ id: 'u1', roles: { admin: true } }) },
        },
        { provide: CloudFunctionsService, useValue: cloud },
        { provide: ConfirmDialogService, useValue: { confirm } },
        { provide: MediaService, useValue: mediaService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMediaUploadAudioAlbumComponent);
    component = fixture.componentInstance;
    mediaUpload = TestBed.inject(MediaUploadService);
    vi.spyOn(mediaUpload, 'putSingle').mockReturnValue(
      of<UploadProgress>({ loaded: 10, total: 10, percent: 100 }),
    );
    vi.spyOn(mediaUpload, 'putParts').mockReturnValue(
      of<UploadProgress>({ loaded: 10, total: 10, percent: 100 }),
    );
    vi.spyOn(component as any, 'coverFromTrack').mockResolvedValue(jpeg());
    vi.spyOn(component as any, 'generateZip').mockResolvedValue({
      status: 'generated',
      name: 'Zips/Le+Cours.zip',
      blob: zipBlob(),
    });
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    (URL as any).createObjectURL = createObjectUrl;
    (URL as any).revokeObjectURL = revokeObjectUrl;
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  async function selectDefaultTracks(): Promise<void> {
    await component.onTracksSelected([mp3('01 - First.mp3'), mp3('02 - Second.mp3')]);
  }

  async function readyToUpload(): Promise<void> {
    component.onTitleChange('Le Cours');
    await selectDefaultTracks();
  }

  it('defaults the date to the current year', () => {
    expect(component).toBeTruthy();
    expect(component.album.date).toBe(String(new Date().getFullYear()));
  });

  it('prefills the folder from the title until the folder is edited', () => {
    component.onTitleChange('Le Cours 2026');
    expect(component.album.folderName).toBe('Le+Cours+2026');
    expect(component.folderPreview()).toBe('Music/Albums/Le+Cours+2026/');

    component.onFolderChange('Custom');
    component.onTitleChange('Another Title');
    expect(component.album.folderName).toBe('Custom');
  });

  it('rejects forbidden folder characters before uploading', async () => {
    await readyToUpload();
    component.onFolderChange('bad/name');

    await component.onUploadSelectedMedia();

    expect(component.formError).toBe(
      'Use a folder name without slashes or special characters.',
    );
    expect(cloud.createMediaUpload).not.toHaveBeenCalled();
  });

  it('rejects a missing folder', async () => {
    await readyToUpload();
    component.onFolderChange('');

    await component.onUploadSelectedMedia();

    expect(component.formError).toBe('Enter the folder name before uploading.');
  });

  it('sorts tracks naturally and moves focus with the moved row', async () => {
    await component.onTracksSelected([
      mp3('10 - Song.mp3'),
      mp3('2 - Song.mp3'),
      mp3('3 - Song.mp3'),
    ]);

    expect(component.trackRows.map(row => row.fileName)).toEqual([
      '2+-+Song.mp3',
      '3+-+Song.mp3',
      '10+-+Song.mp3',
    ]);

    component.moveTrack(0, 1);
    fixture.detectChanges();

    expect(component.trackRows.map(row => row.fileName)).toEqual([
      '3+-+Song.mp3',
      '2+-+Song.mp3',
      '10+-+Song.mp3',
    ]);
    const rows = fixture.nativeElement.querySelectorAll('.album-track-row');
    expect(document.activeElement).toBe(
      rows[1].querySelector('[aria-label="Move track down"]'),
    );

    component.moveTrack(1, -1);
    fixture.detectChanges();

    expect(component.trackRows.map(row => row.fileName)).toEqual([
      '2+-+Song.mp3',
      '3+-+Song.mp3',
      '10+-+Song.mp3',
    ]);
    const movedRow = fixture.nativeElement.querySelectorAll('.album-track-row')[0];
    expect(document.activeElement).toBe(
      movedRow.querySelector('input[name="albumTrackTitle0"]'),
    );
  });

  it('removes a track and moves focus to the next row', async () => {
    await component.onTracksSelected([
      mp3('1 - One.mp3'),
      mp3('2 - Two.mp3'),
      mp3('3 - Three.mp3'),
    ]);

    component.removeTrack(0);
    fixture.detectChanges();

    expect(component.trackRows.map(row => row.fileName)).toEqual([
      '2+-+Two.mp3',
      '3+-+Three.mp3',
    ]);
    expect(document.activeElement).toBe(
      fixture.nativeElement
        .querySelectorAll('.album-track-row')[0]
        .querySelector('[aria-label="Remove track"]'),
    );

    component.removeTrack(0);
    component.removeTrack(0);
    fixture.detectChanges();
    expect(component.trackRows).toEqual([]);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('[data-testid="album-tracks-input"]'),
    );
  });

  it('rejects duplicate derived track filenames', async () => {
    await component.onTracksSelected([mp3('a b.mp3'), mp3('a+b.mp3')]);

    expect(component.formError).toBe(
      'Two tracks use the same file name: "a+b.mp3". Rename one track file before uploading.',
    );
    expect(component.trackRows).toEqual([]);
  });

  it('rejects a non-MP3 track and an oversized track', async () => {
    await component.onTracksSelected([
      new File(['x'], 'fixture.wav', { type: 'audio/wav' }),
    ]);
    expect(component.formError).toBe('Only MP3 tracks can be added.');

    await component.onTracksSelected([fakeMp3('huge.mp3', 209715201)]);
    expect(component.formError).toBe('Each track must be 200 MB or smaller.');
  });

  it('requires at least one track', async () => {
    component.onTitleChange('Le Cours');

    await component.onUploadSelectedMedia();

    expect(component.formError).toBe('Add at least one MP3 track.');
  });

  it('reads the cover from the first track', async () => {
    await component.onTracksSelected([mp3('01 - First.mp3'), mp3('02 - Second.mp3')]);

    expect(component.coverBlob).toBeTruthy();
    expect(component.coverSource).toBe('track');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="album-cover-preview"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="album-cover-source"]')
        .textContent,
    ).toContain('From track art');
  });

  it('accepts a custom cover image', async () => {
    await component.onTracksSelected([mp3('01 - First.mp3')]);
    vi.spyOn(component as any, 'decodeImage').mockResolvedValue({
      width: 800,
      height: 800,
      naturalWidth: 800,
      naturalHeight: 800,
    } as HTMLImageElement);
    vi.spyOn(component as any, 'renderCover').mockResolvedValue(jpeg());

    await component.onCoverFileSelected(jpeg() as unknown as File);

    expect(component.coverSource).toBe('custom');
  });

  it('requires a cover when the track has no art', async () => {
    (component as any).coverFromTrack.mockResolvedValue(null);

    await component.onTracksSelected([mp3('01 - First.mp3')]);
    expect(component.formError).toBe('Add a cover image.');

    component.onTitleChange('Le Cours');
    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Add a cover image.');
    expect(cloud.createMediaUpload).not.toHaveBeenCalled();
  });

  it('generates the zip under the cap and starts no upload on a zip failure', async () => {
    await readyToUpload();
    expect(component.needsManualZip()).toBe(false);
    expect(component.zipSummary()).toContain('Album zip will be generated');

    (component as any).generateZip.mockResolvedValue({
      status: 'error',
      name: 'Zips/Le+Cours.zip',
      error: ALBUM_ZIP_ERROR,
    });
    await component.onUploadSelectedMedia();

    expect(component.formError).toBe(ALBUM_ZIP_ERROR);
    expect(cloud.createMediaUpload).not.toHaveBeenCalled();
  });

  it('requires a manual zip above the cap and accepts an override', async () => {
    await component.onTracksSelected([
      fakeMp3('1 - One.mp3', 190000000),
      fakeMp3('2 - Two.mp3', 190000000),
      fakeMp3('3 - Three.mp3', 190000000),
    ]);
    component.onTitleChange('Le Cours');
    fixture.detectChanges();
    expect(component.needsManualZip()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('input[name="albumZip"]'),
    ).not.toBeNull();

    await component.onUploadSelectedMedia();
    expect(component.formError).toBe('Albums over 500 MB need a zip file.');

    const manualZip = new File(['zip'], 'album.zip', { type: 'application/zip' });
    component.onZipFileSelected(manualZip);
    await component.onUploadSelectedMedia();

    expect(cloud.createMediaUpload).toHaveBeenCalled();
    expect(cloud.createMediaUpload.mock.calls[0][0].album.zip.size).toBe(
      manualZip.size,
    );
  });

  it('uploads cover and zip first, then tracks in list order, and finalizes in order', async () => {
    await readyToUpload();

    await component.onUploadSelectedMedia();

    const request = cloud.createMediaUpload.mock.calls[0][0];
    expect(request.kind).toBe('audio-album');
    expect(request.album.folderName).toBe('Le+Cours');
    expect(request.album.tracks.map((track: any) => track.sourceFileName)).toEqual([
      '01 - First.mp3',
      '02 - Second.mp3',
    ]);
    expect(request.album.tracks.map((track: any) => track.title)).toEqual([
      '01 First',
      '02 Second',
    ]);

    const roles = cloud.resumeMediaUpload.mock.calls.map((call: any[]) => ({
      role: call[0].role,
      trackIndex: call[0].trackIndex,
    }));
    expect(roles).toEqual([
      { role: 'cover', trackIndex: undefined },
      { role: 'zip', trackIndex: undefined },
      { role: 'track', trackIndex: 0 },
      { role: 'track', trackIndex: 1 },
    ]);
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: BATCH,
        trackTitles: ['01 First', '02 Second'],
        metadata: expect.objectContaining({ title: 'Le Cours' }),
      }),
    );
    expect(component.uploadSuccess).toBe('Saved album "Le Cours".');
    expect(component.album.title).toBe('');
    expect(component.trackRows).toEqual([]);
    expect(sessionStorage.getItem(`mediaUploadBatch:${BATCH}`)).toBeNull();
  });

  it('keeps the form and maps a duplicate folder message', async () => {
    await readyToUpload();
    cloud.createMediaUpload.mockRejectedValueOnce({
      code: 'functions/already-exists',
      message: 'server variant',
    });

    await component.onUploadSelectedMedia();

    expect(component.formError).toBe(FOLDER_DUPLICATE);
    expect(component.album.title).toBe('Le Cours');
    expect(component.trackRows.length).toBe(2);
    expect(component.uploadSuccess).toBeNull();
  });

  it('keeps the retry path after a finalize failure', async () => {
    await readyToUpload();
    cloud.finalizeMediaUpload.mockRejectedValueOnce({
      code: 'functions/unavailable',
      message: 'down',
    });

    await component.onUploadSelectedMedia();

    expect(component.finalizeFailed).toBe(true);
    expect(component.formError).toBe(
      'The album uploaded but the record could not be saved. Choose Retry to finish saving.',
    );

    await component.onRetryFinalize();
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledTimes(2);
    expect(cloud.createMediaUpload).toHaveBeenCalledTimes(1);
    expect(component.uploadSuccess).toBe('Saved album "Le Cours".');
  });

  it('hides content controls in edit mode and saves titles and order', async () => {
    const album = new AudioAlbum('a1', 'Old', 'Old');
    album.date = '2020';
    album.listing = ['t1', 't2'];
    mediaService.getMediaById.mockImplementation((id: string) =>
      id === 't1'
        ? { title: 'First', fileName: '01.mp3' }
        : { title: 'Second', fileName: '02.mp3' },
    );

    component.onMediaSelect(album);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="album-tracks-input"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('input[name="albumFolderName"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="album-cover-input"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="album-zip-input"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Remove track"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'To change tracks, delete this album and upload it again.',
    );

    component.moveTrack(1, -1);
    component.trackRows[0].title = 'Second edited';
    await component.onUploadSelectedMedia();

    expect(cloud.createMediaUpload).not.toHaveBeenCalled();
    expect(cloud.updateMediaMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'a1',
        title: 'Old',
        trackTitles: ['Second edited', 'First'],
        listing: ['t2', 't1'],
      }),
    );
    expect(component.uploadSuccess).toBe('Saved album "Old".');
  });

  it('hides the folder picker when webkitdirectory is unsupported', () => {
    vi.spyOn(component as any, 'supportsFolderPicker').mockReturnValue(false);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="album-folder-button"]'),
    ).toBeNull();

    vi.spyOn(component as any, 'supportsFolderPicker').mockReturnValue(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="album-folder-button"]'),
    ).not.toBeNull();
  });

  it('reports the nothing-removed message when object deletion fails', async () => {
    const album = new AudioAlbum('a1', 'Old', 'Old');
    component.onMediaSelect(album);
    cloud.deleteMedia.mockRejectedValueOnce({
      code: 'functions/failed-precondition',
      message: 'Could not delete "Music/Albums/Old/". Retry the delete.',
    });

    await component.onDeleteSelectedMedia(component.album);

    expect(component.deleteError).toBe(
      'Could not delete "Old". Nothing was removed. Retry the delete.',
    );
    expect(component.album.id).toBe('a1');
    expect(component.uploadSuccess).toBeNull();
  });

  it('reports success after a managed delete', async () => {
    const album = new AudioAlbum('a1', 'Old', 'Old');
    component.onMediaSelect(album);

    await component.onDeleteSelectedMedia(component.album);

    expect(cloud.deleteMedia).toHaveBeenCalledWith({ mediaId: 'a1' });
    expect(component.uploadSuccess).toBe('Deleted "Old".');
  });

  it('offers Resume upload and finalizes a stored album batch', async () => {
    sessionStorage.setItem(
      'mediaUploadBatch:album-batch',
      JSON.stringify({
        batchId: 'album-batch',
        kind: 'audio-album',
        mode: 'create',
        storageName: '',
        folderName: 'Le+Cours',
        createdAt: Date.now(),
        metadata: { title: 'Le Cours', date: '2026', isSticky: false, isHidden: false },
        trackTitles: ['One', 'Two'],
        trackFileNames: ['One.mp3', 'Two.mp3'],
      }),
    );
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.resumeBatch?.batchId).toBe('album-batch');
    expect(
      fixture.nativeElement.querySelector('.admin-form-action-button-resume')
        .textContent,
    ).toContain('Resume upload');

    await component.onResumeUpload();

    expect(cloud.finalizeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'album-batch',
        metadata: expect.objectContaining({ title: 'Le Cours', date: '2026' }),
        trackTitles: ['One', 'Two'],
      }),
    );
    expect(component.uploadSuccess).toBe('Saved album "Le Cours".');
  });

  it('asks for files only when resume reports a missing asset', async () => {
    sessionStorage.setItem(
      'mediaUploadBatch:album-batch',
      JSON.stringify({
        batchId: 'album-batch',
        kind: 'audio-album',
        mode: 'create',
        storageName: '',
        folderName: 'Le+Cours',
        createdAt: Date.now(),
        metadata: { title: 'Le Cours', date: '2026', isSticky: false, isHidden: false },
        trackTitles: ['One', 'Two'],
        trackFileNames: ['One.mp3', 'Two.mp3'],
      }),
    );
    component.ngOnInit();
    cloud.finalizeMediaUpload.mockRejectedValueOnce({
      code: 'functions/failed-precondition',
      message:
        'Upload not found or invalid for "Music/Albums/Le+Cours/Two.mp3". Upload the file again.',
    });

    await component.onResumeUpload();

    expect(component.resumeNeedsFiles).toBe(true);
    expect(component.formError).toBe(RESUME_FILES_MESSAGE);
  });

  it('labels every control and exposes live progress and error regions', async () => {
    await selectDefaultTracks();
    component.useOwnZip = true;
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('mat-label')).map(label =>
      (label.textContent ?? '').trim(),
    );
    expect(labels).toContain('Title');
    expect(labels).toContain('Folder name');
    expect(labels).toContain('Date');
    expect(labels).toContain('Track title');
    expect(element.querySelector('label[for="albumTracksInput"]')).not.toBeNull();
    expect(
      element.querySelector('label[for="albumCoverInput"]').textContent,
    ).toContain('Choose cover image');
    expect(
      element.querySelector('label[for="albumZipInput"]').textContent,
    ).toContain('Zip file');
    expect(
      element
        .querySelector('[data-testid="album-upload-progress"]')
        .getAttribute('role'),
    ).toBe('status');

    component.formError = 'Add at least one MP3 track.';
    fixture.detectChanges();
    expect(
      element
        .querySelector('[data-testid="album-upload-error"]')
        .getAttribute('role'),
    ).toBe('alert');
  });
});
