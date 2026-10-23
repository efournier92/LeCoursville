import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import {
  BROWSER_ZIP_MAX_BYTES,
  MAX_TRACK_BYTES,
} from 'src/app/constants/media-upload-constants';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { UploadableMedia } from 'src/app/models/media/media';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { MediaService } from 'src/app/services/media.service';
import {
  ALBUM_ZIP_ERROR,
  AlbumZipResult,
  AlbumZipTrack,
  generateAlbumZip,
} from 'src/app/services/media/album-zip';
import { extractCoverFromFile } from 'src/app/services/media/id3-cover';
import {
  audioFolderName,
  isValidAudioFolderName,
  trackFileName,
  trackTitle,
} from 'src/app/services/media/media-naming';
import {
  ClientMediaUploadTicket,
  CreateMediaUploadRequest,
  MediaUploadError,
  MediaUploadService,
  StoredMediaBatch,
  UploadProgress,
  uploadFailureMessage,
} from 'src/app/services/media-upload.service';

const COVER_MAX_WIDTH = 1000;
const COVER_MAX_HEIGHT = 1000;
const COVER_JPEG_QUALITY = 0.85;
const COVER_REQUIRED = 'Add a cover image.';
const ZIP_REQUIRED = 'Albums over 500 MB need a zip file.';
const FINALIZE_FAILURE =
  'The album uploaded but the record could not be saved. Choose Retry to finish saving.';
const CANCEL_CLEANUP_FAILURE =
  'Upload canceled, but cleanup failed. The storage sweep will remove the file.';
const RESUME_FILES_MESSAGE =
  'Some album files are missing. Select the tracks again, then choose Resume upload.';

export interface AlbumTrackRow {
  id: string;
  title: string;
  fileName: string;
  size: number;
  file?: File | null;
}

type CoverSource = 'track' | 'custom';

type PendingFocus = {
  list: 'up' | 'down' | 'remove' | 'title';
  index: number;
};

@Component({
  selector: 'app-admin-media-upload-audio-album',
  templateUrl: './admin-media-upload-audio-album.component.html',
  styleUrls: ['./admin-media-upload-audio-album.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminMediaUploadAudioAlbumComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  album: AudioAlbum = new AudioAlbum();
  user: User;
  folderEdited = false;
  trackRows: AlbumTrackRow[] = [];
  coverBlob: Blob | null = null;
  coverPreviewUrl: string | null = null;
  coverSource: CoverSource | null = null;
  manualZipFile: File | null = null;
  resumeBatch: StoredMediaBatch | null = null;
  resumeNeedsFiles = false;
  batchId: string | null = null;
  uploading = false;
  finalizeFailed = false;
  progressMessage = '';
  formError: string | null = null;
  uploadSuccess: string | null = null;
  deleteError: string | null = null;

  @ViewChild('albumCardHeading') albumCardHeading?: ElementRef<HTMLElement>;
  @ViewChild('titleInput') titleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('folderInput') folderInput?: ElementRef<HTMLInputElement>;
  @ViewChild('dateInput') dateInput?: ElementRef<HTMLInputElement>;
  @ViewChild('tracksInput') tracksInput?: ElementRef<HTMLInputElement>;
  @ViewChild('coverInput') coverInput?: ElementRef<HTMLInputElement>;
  @ViewChild('zipInput') zipInput?: ElementRef<HTMLInputElement>;
  @ViewChildren('moveUpButton') moveUpButtons?: QueryList<
    ElementRef<HTMLButtonElement>
  >;
  @ViewChildren('moveDownButton') moveDownButtons?: QueryList<
    ElementRef<HTMLButtonElement>
  >;
  @ViewChildren('removeButton') removeButtons?: QueryList<
    ElementRef<HTMLButtonElement>
  >;
  @ViewChildren('trackTitleInput') trackTitleInputs?: QueryList<
    ElementRef<HTMLInputElement>
  >;

  private authSubscription?: Subscription;
  private uploadSubscription?: Subscription;
  private previewObjectUrl: string | null = null;
  private cancelRequested = false;
  private cancelReject?: (reason?: unknown) => void;
  private pendingFocus: PendingFocus | null = null;
  private resumeMissingKey: string | null = null;
  private rowCounter = 0;
  private ownZip = false;

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private mediaUpload: MediaUploadService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.album.date = this.currentYear();
    this.authSubscription = this.authService.userObservable.subscribe(
      (user: User) => (this.user = user),
      () => {},
    );
    const pending = this.mediaUpload.pendingBatch();
    if (pending?.kind === 'audio-album') {
      this.resumeBatch = pending;
      this.applyBatchMetadata(pending);
      this.hydrateRows(pending);
    }
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.uploadSubscription?.unsubscribe();
    this.releasePreviewUrl();
  }

  ngAfterViewChecked(): void {
    const target = this.focusedButton();
    if (target) {
      target.focus();
      this.pendingFocus = null;
    }
  }

  // FORM STATE

  isEditing(): boolean {
    return !!this.album?.id;
  }

  getAudioAlbumTypeId(): string[] {
    return [MediaConstants.AUDIO_ALBUM.id];
  }

  isUserAdmin(): boolean {
    return !!(this.user?.roles?.admin || this.user?.roles?.super);
  }

  folderPreview(): string {
    return `Music/Albums/${audioFolderName(this.album.folderName)}/`;
  }

  onTitleChange(value: string): void {
    this.album.title = value;
    if (!this.folderEdited) {
      this.album.folderName = value?.trim() ? audioFolderName(value) : '';
    }
  }

  onFolderChange(value: string): void {
    this.album.folderName = value;
    this.folderEdited = true;
  }

  supportsFolderPicker(): boolean {
    return 'webkitdirectory' in document.createElement('input');
  }

  onMediaSelect(media: AudioAlbum): void {
    this.releasePreviewUrl();
    this.album = { ...new AudioAlbum(), ...media };
    this.folderEdited = true;
    this.trackRows = this.rowsFromAlbum(media);
    this.coverBlob = null;
    this.coverPreviewUrl = null;
    this.coverSource = null;
    this.useOwnZip = false;
    this.manualZipFile = null;
    this.resumeBatch = null;
    this.resumeNeedsFiles = false;
    this.resumeMissingKey = null;
    this.batchId = null;
    this.uploading = false;
    this.finalizeFailed = false;
    this.progressMessage = '';
    this.formError = null;
    this.uploadSuccess = null;
    this.deleteError = null;
  }

  onClearForm(): void {
    this.resetForm();
    this.uploadSuccess = null;
    this.deleteError = null;
  }

  // TRACK SELECTION AND ORDERING

  async onTracksSelected(files: File[]): Promise<void> {
    const selected = (files ?? []).filter(Boolean);
    if (selected.length === 0) {
      return;
    }
    const fileError = this.trackFilesError(selected);
    if (fileError) {
      this.formError = fileError;
      this.uploadSuccess = null;
      this.focusFirstInvalid();
      return;
    }

    this.formError = null;
    this.uploadSuccess = null;
    const rows = selected
      .map(file => this.rowFromFile(file))
      .sort((a, b) => this.naturalCompare(a.file?.name ?? '', b.file?.name ?? ''));
    this.trackRows =
      this.resumeBatch && this.resumeNeedsFiles
        ? this.orderRowsForResume(rows)
        : rows;
    await this.readCoverFromTrackFile(selected[0]);
  }

  onTracksFileChange(event: Event): void {
    const files = (event.target as HTMLInputElement)?.files;
    if (files?.length) {
      void this.onTracksSelected(Array.from(files));
    }
  }

  onTracksDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      void this.onTracksSelected(Array.from(files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  moveTrack(index: number, delta: number): void {
    const next = index + delta;
    if (next < 0 || next >= this.trackRows.length) {
      return;
    }
    const [row] = this.trackRows.splice(index, 1);
    this.trackRows.splice(next, 0, row);
    this.pendingFocus = { list: delta < 0 ? 'up' : 'down', index: next };
  }

  removeTrack(index: number): void {
    if (index < 0 || index >= this.trackRows.length) {
      return;
    }
    this.trackRows.splice(index, 1);
    if (this.trackRows.length === 0) {
      this.pendingFocus = { list: 'title', index: 0 };
      return;
    }
    this.pendingFocus = {
      list: 'remove',
      index: Math.min(index, this.trackRows.length - 1),
    };
  }

  rowSize(row: AlbumTrackRow): string {
    return this.formatFileSize(row.size);
  }

  // COVER

  async onCoverFileSelected(file: File): Promise<void> {
    if (!this.isCoverImage(file)) {
      this.formError = COVER_REQUIRED;
      this.focusFirstInvalid();
      return;
    }
    try {
      const image = await this.decodeImage(file);
      const blob = await this.renderCover(image);
      if (!blob) {
        throw new Error('cover encode failed');
      }
      this.setCover(blob, 'custom');
      this.formError = null;
    } catch {
      this.setCover(null);
      this.formError = COVER_REQUIRED;
    }
  }

  onCoverFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (file) {
      void this.onCoverFileSelected(file);
    }
  }

  onZipFileSelected(file: File): void {
    if (!this.isZipFile(file)) {
      this.formError = ZIP_REQUIRED;
      this.focusFirstInvalid();
      return;
    }
    this.manualZipFile = file;
    this.formError = null;
  }

  onZipFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (file) {
      this.onZipFileSelected(file);
    }
  }

  needsManualZip(): boolean {
    return this.totalTrackBytes() > BROWSER_ZIP_MAX_BYTES;
  }

  get useOwnZip(): boolean {
    return this.ownZip;
  }

  set useOwnZip(value: boolean) {
    this.ownZip = value;
    if (value) {
      return;
    }
    this.manualZipFile = null;
    if (this.zipInput) {
      this.zipInput.nativeElement.value = '';
    }
  }

  totalTrackBytes(): number {
    return this.trackRows.reduce((total, row) => total + (row.size || 0), 0);
  }

  zipSummary(): string {
    return `Album zip will be generated (${this.summaryMb(
      this.totalTrackBytes(),
    )} MB).`;
  }

  // UPLOAD

  async onUploadSelectedMedia(): Promise<void> {
    if (this.uploading) {
      return;
    }
    if (this.isEditing()) {
      await this.saveMetadata();
      return;
    }

    const validationError = this.formValidationError();
    if (validationError) {
      this.formError = validationError;
      this.uploadSuccess = null;
      this.focusFirstInvalid();
      return;
    }

    const folder = audioFolderName(this.album.folderName);
    const title = this.album.title.trim();
    this.formError = null;
    this.uploadSuccess = null;
    this.finalizeFailed = false;
    this.cancelRequested = false;
    this.uploading = true;
    try {
      const zip = await this.buildZip(folder);
      if ('error' in zip) {
        this.formError = zip.error;
        this.focusFirstInvalid();
        return;
      }
      const coverFile = this.coverFile();
      if (!coverFile) {
        this.formError = COVER_REQUIRED;
        this.focusFirstInvalid();
        return;
      }

      const created = await this.createAndUpload(folder, coverFile, zip.file);
      if (!created) {
        return;
      }
      try {
        await this.finalizeAlbum(created);
      } catch {
        this.finalizeFailed = true;
        this.formError = FINALIZE_FAILURE;
        this.focusHeading();
        return;
      }
      this.resumeBatch = null;
      this.resetForm();
      this.uploadSuccess = `Saved album "${title}".`;
      this.focusHeading();
    } catch (error) {
      if (this.cancelRequested) {
        this.cancelRequested = false;
        return;
      }
      this.formError = this.uploadErrorMessage(error, folder);
      this.focusFirstInvalid();
    } finally {
      this.uploading = false;
      this.progressMessage = '';
    }
  }

  async onRetryFinalize(): Promise<void> {
    if (this.uploading) {
      return;
    }
    const title = this.album.title.trim();
    this.uploading = true;
    this.formError = null;
    this.progressMessage = 'Saving record...';
    try {
      await this.mediaUpload.retryFinalize();
      this.resumeBatch = null;
      this.resetForm();
      this.uploadSuccess = `Saved album "${title}".`;
      this.focusHeading();
    } catch {
      this.formError = FINALIZE_FAILURE;
      this.focusHeading();
    } finally {
      this.uploading = false;
      this.progressMessage = '';
    }
  }

  async onResumeUpload(): Promise<void> {
    const batch = this.resumeBatch;
    if (!batch || this.uploading) {
      return;
    }
    this.applyBatchMetadata(batch);
    const title = (this.album.title || '').trim();
    this.uploading = true;
    this.formError = null;
    this.uploadSuccess = null;
    this.progressMessage = 'Saving record...';
    try {
      await this.finalizeBatch(batch);
      this.resumeBatch = null;
      this.resumeNeedsFiles = false;
      this.resetForm();
      this.uploadSuccess = `Saved album "${title}".`;
      this.focusHeading();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'upload-not-found') {
        this.resumeMissingKey = this.missingKey(error);
        if (this.canUploadMissingAsset(batch)) {
          try {
            await this.uploadMissingAsset(batch);
            await this.finalizeBatch(batch);
            this.resumeBatch = null;
            this.resumeNeedsFiles = false;
            this.resetForm();
            this.uploadSuccess = `Saved album "${title}".`;
            this.focusHeading();
            return;
          } catch {
            this.resumeNeedsFiles = true;
            this.formError = RESUME_FILES_MESSAGE;
            this.focusFirstInvalid();
            return;
          }
        }
        this.resumeNeedsFiles = true;
        this.formError = RESUME_FILES_MESSAGE;
        this.focusFirstInvalid();
      } else {
        this.finalizeFailed = true;
        this.formError = FINALIZE_FAILURE;
        this.focusHeading();
      }
    } finally {
      this.uploading = false;
      this.progressMessage = '';
    }
  }

  async onCancelUpload(): Promise<void> {
    const batchId = this.batchId;
    this.cancelRequested = true;
    this.uploadSubscription?.unsubscribe();
    this.uploadSubscription = undefined;
    this.cancelReject?.(new Error('Upload canceled.'));
    this.cancelReject = undefined;
    this.uploading = false;
    this.finalizeFailed = false;
    this.progressMessage = '';
    if (!batchId) {
      return;
    }
    try {
      await this.mediaUpload.cancelBatch(batchId);
    } catch {
      this.formError = CANCEL_CLEANUP_FAILURE;
    } finally {
      this.mediaUpload.clearBatchState(batchId);
      this.batchId = null;
    }
  }

  // EDIT AND DELETE

  async onDeleteSelectedMedia(media: UploadableMedia): Promise<void> {
    const title = media?.title || media?.folderName || 'this album';
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete album?',
      message: `Delete "${title}"? This cannot be undone.`,
      confirmLabel: 'Delete album',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.deleteError = null;
    try {
      await this.mediaUpload.deleteRecord(media.id);
      this.resumeBatch = null;
      this.resetForm();
      this.uploadSuccess = `Deleted "${title}".`;
      this.focusHeading();
    } catch {
      this.deleteError = `Could not delete "${title}". Nothing was removed. Retry the delete.`;
      this.focusHeading();
    }
  }

  // VALIDATION

  private formValidationError(): string | null {
    if (!this.album.title?.trim()) {
      return 'Enter the title before uploading.';
    }
    if (!this.album.folderName?.trim()) {
      return 'Enter the folder name before uploading.';
    }
    if (!isValidAudioFolderName(this.album.folderName)) {
      return 'Use a folder name without slashes or special characters.';
    }
    if (!this.album.date?.trim()) {
      return 'Enter the date before uploading.';
    }
    if (
      this.trackRows.length === 0 ||
      this.trackRows.some(row => !row.file)
    ) {
      return 'Add at least one MP3 track.';
    }
    for (const row of this.trackRows) {
      const fileError = this.trackFileError(row.file as File);
      if (fileError) {
        return fileError;
      }
    }
    const duplicate = this.duplicateTrackFile(this.trackRows);
    if (duplicate) {
      return this.duplicateTrackMessage(duplicate);
    }
    if (!this.coverBlob) {
      return COVER_REQUIRED;
    }
    if (this.needsManualZip()) {
      if (!this.manualZipFile) {
        return ZIP_REQUIRED;
      }
      if (!this.isZipFile(this.manualZipFile)) {
        return ZIP_REQUIRED;
      }
    }
    return null;
  }

  private trackFilesError(files: File[]): string | null {
    for (const file of files) {
      const fileError = this.trackFileError(file);
      if (fileError) {
        return fileError;
      }
    }
    const rows = files.map(file => ({ fileName: trackFileName(file.name) }));
    const duplicate = this.duplicateTrackFile(rows);
    return duplicate ? this.duplicateTrackMessage(duplicate) : null;
  }

  private trackFileError(file: File): string | null {
    if (
      !file.name.toLowerCase().endsWith('.mp3') ||
      (file.type && file.type !== 'audio/mpeg')
    ) {
      return 'Only MP3 tracks can be added.';
    }
    if (file.size > MAX_TRACK_BYTES) {
      return 'Each track must be 200 MB or smaller.';
    }
    return null;
  }

  private duplicateTrackFile(
    rows: Array<{ fileName: string }>,
  ): string | null {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.fileName)) {
        return row.fileName;
      }
      seen.add(row.fileName);
    }
    return null;
  }

  private duplicateTrackMessage(fileName: string): string {
    return `Two tracks use the same file name: "${fileName}". Rename one track file before uploading.`;
  }

  private isCoverImage(file: File): boolean {
    return (
      !file.type ||
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    );
  }

  private isZipFile(file: File): boolean {
    return (
      file.name.toLowerCase().endsWith('.zip') &&
      (!file.type || file.type === 'application/zip')
    );
  }

  // UPLOAD PIPELINE

  private createRequest(
    folder: string,
    coverFile: File,
    zipFile: File,
  ): CreateMediaUploadRequest {
    return {
      kind: 'audio-album',
      mode: 'create',
      album: {
        folderName: folder,
        cover: { size: coverFile.size, contentType: 'image/jpeg' },
        zip: { size: zipFile.size, contentType: 'application/zip' },
        tracks: this.trackRows.map(row => ({
          sourceFileName: (row.file as File).name,
          title: row.title,
          size: (row.file as File).size,
          contentType: 'audio/mpeg' as const,
        })),
      },
    };
  }

  private async createAndUpload(
    folder: string,
    coverFile: File,
    zipFile: File,
  ): Promise<string | null> {
    const response = await this.mediaUpload.createBatch(
      this.createRequest(folder, coverFile, zipFile),
    );
    this.batchId = response.batchId;
    this.resumeBatch = null;
    this.rememberAlbumBatch(response.batchId, folder);
    if (this.cancelRequested) {
      await this.mediaUpload.cancelBatch(response.batchId);
      this.mediaUpload.clearBatchState(response.batchId);
      this.batchId = null;
      return null;
    }
    await this.uploadAssets(response.batchId, coverFile, zipFile);
    return response.batchId;
  }

  private rememberAlbumBatch(batchId: string, folder: string): void {
    this.mediaUpload.rememberBatch({
      batchId,
      kind: 'audio-album',
      mode: 'create',
      storageName: '',
      folderName: folder,
      createdAt: Date.now(),
      metadata: this.metadata(),
      trackTitles: this.trackRows.map(row => row.title),
      trackFileNames: this.trackRows.map(row => row.fileName),
    });
  }

  private async uploadAssets(
    batchId: string,
    coverFile: File,
    zipFile: File,
  ): Promise<void> {
    // Small assets first: a dropped track response then leaves only bytes
    // that already landed, so a reload can finalize without re-selecting files.
    if (!this.mediaUpload.isAssetCompleted(batchId, { role: 'cover' })) {
      const [ticket] = await this.mediaUpload.resume(batchId, 'cover');
      if (ticket) {
        this.progressMessage = 'Uploading cover...';
        await this.uploadTicket(ticket, coverFile, () => {});
      }
    }

    if (!this.mediaUpload.isAssetCompleted(batchId, { role: 'zip' })) {
      const [ticket] = await this.mediaUpload.resume(batchId, 'zip');
      if (ticket) {
        this.progressMessage = 'Uploading zip...';
        await this.uploadTicket(ticket, zipFile, () => {});
      }
    }

    const total = this.trackRows.length;
    for (let index = 0; index < total; index++) {
      const file = this.trackRows[index].file;
      if (!file) {
        continue;
      }
      if (
        this.mediaUpload.isAssetCompleted(batchId, {
          role: 'track',
          trackIndex: index,
        })
      ) {
        continue;
      }
      const [ticket] = await this.mediaUpload.resume(batchId, 'track', index);
      if (!ticket) {
        continue;
      }
      this.showTrackProgress(index, total, 0);
      await this.uploadTicket(ticket, file, progress =>
        this.showTrackProgress(index, total, progress.percent),
      );
    }

  }

  private uploadTicket(
    ticket: ClientMediaUploadTicket,
    file: File,
    onProgress: (progress: UploadProgress) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const stream =
        ticket.mode === 'single'
          ? this.mediaUpload.putSingle(ticket, file)
          : this.mediaUpload.putParts(ticket, file);
      this.cancelReject = reject;
      this.uploadSubscription = stream.subscribe({
        next: (progress: UploadProgress) => onProgress(progress),
        error: reject,
        complete: () => {
          this.cancelReject = undefined;
          this.uploadSubscription = undefined;
          resolve();
        },
      });
    });
  }

  private showTrackProgress(index: number, total: number, percent: number): void {
    this.progressMessage = `Uploading track ${index + 1} of ${total} (${percent}%).`;
  }

  private async finalizeAlbum(batchId: string): Promise<void> {
    this.progressMessage = 'Saving record...';
    try {
      await this.mediaUpload.finalize({
        batchId,
        metadata: this.metadata(),
        trackTitles: this.trackRows.map(row => row.title),
      });
    } finally {
      this.progressMessage = '';
    }
  }

  private finalizeBatch(batch: StoredMediaBatch): Promise<unknown> {
    this.progressMessage = 'Saving record...';
    return this.mediaUpload.finalize({
      batchId: batch.batchId,
      metadata: this.metadata(),
      trackTitles: this.trackTitlesFor(batch),
    });
  }

  private trackTitlesFor(batch: StoredMediaBatch): string[] {
    if (this.trackRows.length > 0) {
      return this.trackRows.map(row => row.title);
    }
    return batch.trackTitles ?? [];
  }

  private async saveMetadata(): Promise<void> {
    const error = this.metadataValidationError();
    if (error) {
      this.formError = error;
      this.uploadSuccess = null;
      this.focusFirstInvalid();
      return;
    }

    const title = this.album.title.trim();
    this.formError = null;
    this.uploadSuccess = null;
    this.uploading = true;
    this.progressMessage = 'Saving record...';
    try {
      await this.mediaUpload.updateMetadata({
        mediaId: this.album.id,
        title,
        date: this.album.date,
        isSticky: !!this.album.isSticky,
        isHidden: !!this.album.isHidden,
        trackTitles: this.trackRows.map(row => row.title),
        listing: this.trackRows.map(row => row.id),
      });
      this.resumeBatch = null;
      this.resetForm();
      this.uploadSuccess = `Saved album "${title}".`;
      this.focusHeading();
    } catch (error) {
      this.formError =
        (error as Error)?.message ||
        uploadFailureMessage(this.album.folderName);
      this.focusFirstInvalid();
    } finally {
      this.uploading = false;
      this.progressMessage = '';
    }
  }

  private metadata(): {
    title: string;
    date: string;
    isSticky: boolean;
    isHidden: boolean;
  } {
    return {
      title: (this.album.title ?? '').trim(),
      date: this.album.date ?? '',
      isSticky: !!this.album.isSticky,
      isHidden: !!this.album.isHidden,
    };
  }

  private metadataValidationError(): string | null {
    if (!this.album.title?.trim()) {
      return 'Enter the title before uploading.';
    }
    if (!this.album.date?.trim()) {
      return 'Enter the date before uploading.';
    }
    return null;
  }

  private uploadErrorMessage(error: unknown, folder: string): string {
    const code = (error as { code?: string })?.code;
    if (code === 'already-exists') {
      const message = (error as { message?: string })?.message ?? '';
      if (message.startsWith('An orphan file')) {
        return message;
      }
      return `A folder named "${folder}" already exists. Delete the existing album or choose a different folder name.`;
    }
    if (error instanceof MediaUploadError) {
      return error.message;
    }
    return uploadFailureMessage(this.album.folderName);
  }

  // ZIP

  private async buildZip(
    folder: string,
  ): Promise<{ file: File } | { error: string }> {
    if (this.needsManualZip()) {
      if (!this.manualZipFile || !this.isZipFile(this.manualZipFile)) {
        return { error: ZIP_REQUIRED };
      }
      return { file: this.manualZipFile };
    }
    if (this.manualZipFile) {
      if (!this.isZipFile(this.manualZipFile)) {
        return { error: ZIP_REQUIRED };
      }
      return { file: this.manualZipFile };
    }
    const result = await this.generateZip(folder, this.zipTracks());
    if (result.status === 'generated') {
      return {
        file: new File([result.blob], `${folder}.zip`, {
          type: 'application/zip',
        }),
      };
    }
    if (result.status === 'error') {
      return { error: result.error };
    }
    return { error: ZIP_REQUIRED };
  }

  protected generateZip(
    folder: string,
    tracks: AlbumZipTrack[],
  ): Promise<AlbumZipResult> {
    return generateAlbumZip(folder, tracks, this.totalTrackBytes());
  }

  private zipTracks(): AlbumZipTrack[] {
    return this.trackRows
      .filter(row => !!row.file)
      .map(row => ({ name: row.fileName, file: row.file as File }));
  }

  // COVER PIPELINE

  private async readCoverFromTrackFile(file: File): Promise<void> {
    const blob = await this.coverFromTrack(file);
    if (!blob) {
      this.setCover(null);
      this.formError = COVER_REQUIRED;
      return;
    }
    this.setCover(blob, 'track');
  }

  protected async coverFromTrack(file: File): Promise<Blob | null> {
    const cover = await extractCoverFromFile(file);
    if (!cover) {
      return null;
    }
    const blob = new Blob([new Uint8Array(cover.bytes)], {
      type: cover.mime,
    });
    const image = await this.decodeImage(blob);
    return this.renderCover(image);
  }

  protected decodeImage(file: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = this.objectUrl(file);
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('image decode failed'));
      if (url) {
        image.src = url;
      } else {
        reject(new Error('image decode failed'));
      }
    });
  }

  protected renderCover(image: HTMLImageElement): Promise<Blob | null> {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const size = this.scaleCover(width, height);
    if (!size.width || !size.height) {
      return Promise.resolve(null);
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return Promise.resolve(null);
    }
    context.drawImage(image, 0, 0, size.width, size.height);
    return new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', COVER_JPEG_QUALITY),
    );
  }

  private scaleCover(width: number, height: number): { width: number; height: number } {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return { width: 0, height: 0 };
    }
    const scale = Math.min(1, COVER_MAX_WIDTH / width, COVER_MAX_HEIGHT / height);
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  private setCover(blob: Blob | null, source: CoverSource | null = null): void {
    this.releasePreviewUrl();
    this.coverBlob = blob;
    this.coverSource = blob ? source : null;
    this.coverPreviewUrl = blob ? this.objectUrl(blob) : null;
  }

  private coverFile(): File | null {
    if (!this.coverBlob) {
      return null;
    }
    return new File([this.coverBlob], 'cover.jpg', { type: 'image/jpeg' });
  }

  // EDIT AND RESUME HELPERS

  private rowsFromAlbum(album: AudioAlbum): AlbumTrackRow[] {
    const listing = Array.isArray(album?.listing) ? album.listing : [];
    return listing.map(id => {
      const record = this.mediaService.getMediaById(id);
      return {
        id,
        title: record?.title ?? '',
        fileName: record?.fileName ?? '',
        size: 0,
        file: null,
      };
    });
  }

  private hydrateRows(batch: StoredMediaBatch): void {
    if (this.trackRows.length > 0) {
      return;
    }
    const titles = batch.trackTitles ?? [];
    const names = batch.trackFileNames ?? [];
    const count = Math.max(titles.length, names.length);
    this.trackRows = Array.from({ length: count }, (_, index) => ({
      id: `resume-${index}`,
      title: titles[index] ?? '',
      fileName: names[index] ?? '',
      size: 0,
      file: null,
    }));
  }

  private applyBatchMetadata(batch: StoredMediaBatch): void {
    if (batch.folderName && !this.folderEdited) {
      this.album.folderName = batch.folderName;
    }
    if (batch.folderName && !this.album.folderName) {
      this.album.folderName = batch.folderName;
    }
    this.folderEdited = true;
    if (batch.metadata) {
      this.album.title = batch.metadata.title;
      this.album.date = batch.metadata.date;
      this.album.isSticky = batch.metadata.isSticky;
      this.album.isHidden = batch.metadata.isHidden;
    }
  }

  private orderRowsForResume(rows: AlbumTrackRow[]): AlbumTrackRow[] {
    const names = this.resumeBatch?.trackFileNames ?? [];
    if (names.length === 0) {
      return rows;
    }
    const byName = new Map(rows.map(row => [row.fileName, row]));
    const ordered = names
      .map(name => byName.get(name))
      .filter((row): row is AlbumTrackRow => !!row);
    if (ordered.length !== names.length) {
      this.formError = RESUME_FILES_MESSAGE;
    }
    return ordered.length > 0 ? ordered : rows;
  }

  private canUploadMissingAsset(batch: StoredMediaBatch): boolean {
    const key = this.resumeMissingKey;
    const fileName = this.missingTrackFileName(batch, key);
    if (!fileName) {
      return false;
    }
    const index = (batch.trackFileNames ?? []).indexOf(fileName);
    return index >= 0 && !!this.trackRows[index]?.file;
  }

  private async uploadMissingAsset(batch: StoredMediaBatch): Promise<void> {
    const fileName = this.missingTrackFileName(batch, this.resumeMissingKey);
    if (!fileName) {
      throw new Error(RESUME_FILES_MESSAGE);
    }
    const index = (batch.trackFileNames ?? []).indexOf(fileName);
    const file = this.trackRows[index]?.file;
    if (!file) {
      throw new Error(RESUME_FILES_MESSAGE);
    }
    const [ticket] = await this.mediaUpload.resume(batch.batchId, 'track', index);
    if (!ticket) {
      throw new Error(RESUME_FILES_MESSAGE);
    }
    const total = (batch.trackFileNames ?? []).length;
    this.showTrackProgress(index, total, 0);
    await this.uploadTicket(ticket, file, progress =>
      this.showTrackProgress(index, total, progress.percent),
    );
  }

  private missingTrackFileName(
    batch: StoredMediaBatch,
    key: string | null,
  ): string | null {
    if (!key || !batch.folderName) {
      return null;
    }
    const prefix = `Music/Albums/${batch.folderName}/`;
    return key.startsWith(prefix) ? key.slice(prefix.length) : null;
  }

  private missingKey(error: unknown): string | null {
    const message = (error as { message?: string })?.message ?? '';
    const match = message.match(/for "([^"]+)"/);
    return match ? match[1] : null;
  }

  // RESET AND FOCUS

  private resetForm(): void {
    this.releasePreviewUrl();
    this.album = new AudioAlbum();
    this.album.title = '';
    this.album.folderName = '';
    this.album.date = this.currentYear();
    this.folderEdited = false;
    this.trackRows = [];
    this.coverBlob = null;
    this.coverPreviewUrl = null;
    this.coverSource = null;
    this.useOwnZip = false;
    this.manualZipFile = null;
    this.batchId = null;
    this.finalizeFailed = false;
    this.resumeNeedsFiles = false;
    this.resumeMissingKey = null;
    this.progressMessage = '';
    if (this.tracksInput) {
      this.tracksInput.nativeElement.value = '';
    }
    if (this.coverInput) {
      this.coverInput.nativeElement.value = '';
    }
    if (this.zipInput) {
      this.zipInput.nativeElement.value = '';
    }
  }

  private releasePreviewUrl(): void {
    if (this.previewObjectUrl) {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(this.previewObjectUrl);
      }
      this.previewObjectUrl = null;
    }
  }

  private focusHeading(): void {
    this.albumCardHeading?.nativeElement.focus();
  }

  private focusFirstInvalid(): void {
    const message = this.formError;
    const target =
      message?.startsWith('Enter the title')
        ? this.titleInput?.nativeElement
        : message?.startsWith('Enter the folder') ||
            message?.startsWith('Use a folder')
          ? this.folderInput?.nativeElement
          : message?.startsWith('Enter the date')
            ? this.dateInput?.nativeElement
            : message?.startsWith('Add at least one') ||
                message?.startsWith('Only MP3') ||
                message?.startsWith('Each track') ||
                message?.startsWith('Two tracks') ||
                message?.startsWith('Some album files')
              ? this.tracksInput?.nativeElement
              : message?.startsWith('Add a cover')
                ? this.coverInput?.nativeElement
                : message?.startsWith('Albums over') ||
                    message?.startsWith('Album zip generation')
                  ? this.zipInput?.nativeElement
                  : this.albumCardHeading?.nativeElement;
    target?.focus();
  }

  private focusedButton(): HTMLElement | undefined {
    if (!this.pendingFocus) {
      return undefined;
    }
    const { list, index } = this.pendingFocus;
    if (list === 'up') {
      return this.usableButton(this.moveUpButtons?.get(index)?.nativeElement, index);
    }
    if (list === 'down') {
      return this.usableButton(this.moveDownButtons?.get(index)?.nativeElement, index);
    }
    if (list === 'remove') {
      return this.removeButtons?.get(index)?.nativeElement;
    }
    const title = this.trackTitleInputs?.get(index)?.nativeElement;
    if (title) {
      return title;
    }
    return this.tracksInput?.nativeElement;
  }

  // SMALL HELPERS

  private usableButton(
    button: HTMLButtonElement | undefined,
    index: number,
  ): HTMLElement | undefined {
    if (button && !button.disabled) {
      return button;
    }
    return (
      this.trackTitleInputs?.get(index)?.nativeElement ??
      this.tracksInput?.nativeElement
    );
  }

  private rowFromFile(file: File): AlbumTrackRow {
    return {
      id: `track-${++this.rowCounter}`,
      title: trackTitle(file.name),
      fileName: trackFileName(file.name),
      size: file.size,
      file,
    };
  }

  private naturalCompare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  private currentYear(): string {
    return String(new Date().getFullYear());
  }

  private formatFileSize(bytes: number): string {
    if (!bytes) {
      return '';
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private summaryMb(bytes: number): string {
    return String(Math.round(bytes / (1024 * 1024)));
  }

  private objectUrl(blob: Blob): string | null {
    try {
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
}
