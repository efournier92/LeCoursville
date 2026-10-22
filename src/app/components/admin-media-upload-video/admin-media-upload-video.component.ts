import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';
import { Video } from 'src/app/models/media/video';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import {
  ClientMediaUploadTicket,
  CreateMediaUploadRequest,
  MediaUploadError,
  MediaUploadService,
  StoredMediaBatch,
  UploadProgress,
  uploadFailureMessage,
} from 'src/app/services/media-upload.service';
import {
  encodeJpeg,
  scaleToThumbnail,
  thumbnailSeekTime,
  captureVideoThumbnail,
} from 'src/app/services/media/video-thumbnail';
import {
  isValidVideoStorageName,
  videoIconKey,
  videoKey,
  videoStorageName,
} from 'src/app/services/media/media-naming';

const MAX_VIDEO_BYTES = 2147483648;
const THUMBNAIL_FAILURE = 'Automatic thumbnail failed. Choose a thumbnail image.';
const FINALIZE_FAILURE =
  'The file uploaded but the record could not be saved. Choose Retry to finish saving.';
const CANCEL_CLEANUP_FAILURE =
  'Upload canceled, but cleanup failed. The storage sweep will remove the file.';

@Component({
  selector: 'app-admin-media-upload-video',
  templateUrl: './admin-media-upload-video.component.html',
  styleUrls: ['./admin-media-upload-video.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminMediaUploadVideoComponent implements OnInit, OnDestroy {
  video: Video = new Video();
  user: User;
  deleteError: string | null = null;
  formError: string | null = null;
  uploadSuccess: string | null = null;
  progressMessage = '';
  uploading = false;
  finalizeFailed = false;
  replaceFile = false;
  resumeBatch: StoredMediaBatch | null = null;
  batchId: string | null = null;
  captureFailed = false;

  storageName = '';
  pathProvisional = true;
  thumbnailTime = 0;
  durationSeconds = 0;
  thumbnailPreviewUrl: string | null = null;
  selectedVideoFile: File | null = null;
  thumbnailBlob: Blob | null = null;

  @ViewChild('videoCardHeading') videoCardHeading?: ElementRef<HTMLElement>;
  @ViewChild('videoFileInput') videoFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('titleInput') titleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('dateInput') dateInput?: ElementRef<HTMLInputElement>;
  @ViewChild('storageNameInput') storageNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('thumbnailInput') thumbnailInput?: ElementRef<HTMLInputElement>;

  private authoritativeKeys: { key: string; iconKey: string } | null = null;
  private authSubscription?: Subscription;
  private uploadSubscription?: Subscription;
  private thumbnailVideo: HTMLVideoElement | null = null;
  private videoObjectUrl: string | null = null;
  private previewObjectUrl: string | null = null;
  private cancelRequested = false;
  private cancelReject?: (reason?: unknown) => void;

  constructor(
    private authService: AuthService,
    private mediaUpload: MediaUploadService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.video.date = this.currentYear();
    this.authSubscription = this.authService.userObservable.subscribe(
      (user: User) => (this.user = user),
      () => {},
    );
    const pending = this.mediaUpload.pendingBatch();
    this.resumeBatch = pending?.kind === 'video' ? pending : null;
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.uploadSubscription?.unsubscribe();
    this.releaseObjectUrls();
  }

  // FORM STATE

  isEditing(): boolean {
    return !!this.video?.id;
  }

  showsFileControls(): boolean {
    return !this.isEditing() || this.replaceFile;
  }

  previewVideoKey(): string {
    return this.authoritativeKeys?.key ?? videoKey(this.storageName);
  }

  previewIconKey(): string {
    return this.authoritativeKeys?.iconKey ?? videoIconKey(this.storageName);
  }

  getVideoTypeId(): string[] {
    return [MediaConstants.VIDEO.id];
  }

  onMediaSelect(media: Video): void {
    this.releaseObjectUrls();
    this.video = { ...new Video(), ...media };
    this.storageName = this.editStorageName(media);
    this.replaceFile = false;
    this.finalizeFailed = false;
    this.uploading = false;
    this.progressMessage = '';
    this.formError = null;
    this.uploadSuccess = null;
    this.deleteError = null;
    this.selectedVideoFile = null;
    this.thumbnailBlob = null;
    this.authoritativeKeys =
      media?.storage?.key && media?.storage?.iconKey
        ? { key: media.storage.key, iconKey: media.storage.iconKey }
        : null;
    this.pathProvisional = !this.authoritativeKeys;
    this.thumbnailPreviewUrl = media?.urls?.icon || null;
    this.durationSeconds = 0;
    this.thumbnailTime = 0;
  }

  onClearForm(): void {
    this.resetForm();
    this.uploadSuccess = null;
    this.deleteError = null;
  }

  // FILE SELECTION

  async onVideoFileSelected(file: File): Promise<void> {
    const fileError = this.videoFileError(file);
    if (fileError) {
      this.formError = fileError;
      this.uploadSuccess = null;
      this.focusFirstInvalid();
      return;
    }

    this.formError = null;
    this.uploadSuccess = null;
    this.selectedVideoFile = file;
    this.replaceFile = this.replaceFile || this.isEditing();
    this.storageName = this.isEditing()
      ? this.storageName
      : videoStorageName(file.name);
    if (!this.video.title?.trim()) {
      this.video.title = this.titleFromFileName(file.name);
    }
    if (!this.video.date?.trim()) {
      this.video.date = this.currentYear();
    }
    this.pathProvisional = true;
    this.authoritativeKeys = null;
    await this.loadSelectedVideo();
  }

  onVideoFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (file) {
      void this.onVideoFileSelected(file);
    }
  }

  onVideoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.onVideoFileSelected(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  // THUMBNAIL

  async onThumbnailTimeChange(value: number | string): Promise<void> {
    const time = Number(value);
    this.thumbnailTime = time;
    if (!this.thumbnailVideo) {
      return;
    }
    const blob = await this.captureFrameAt(this.thumbnailVideo, time);
    this.setThumbnail(blob);
    if (!blob) {
      this.thumbnailCaptureFailed();
    }
  }

  async onThumbnailFileSelected(file: File): Promise<void> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.formError = 'Choose a thumbnail image.';
      return;
    }
    try {
      const image = await this.decodeImage(file);
      const blob = await this.renderImage(image);
      if (!blob) {
        throw new Error('thumbnail encode failed');
      }
      this.setThumbnail(blob);
      this.formError = null;
    } catch {
      this.thumbnailCaptureFailed();
    }
  }

  onThumbnailFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (file) {
      void this.onThumbnailFileSelected(file);
    }
  }

  // UPLOAD

  async onUploadSelectedMedia(): Promise<void> {
    if (this.uploading) {
      return;
    }
    if (this.isEditing() && !this.replaceFile) {
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

    const title = this.video.title.trim();
    this.formError = null;
    this.uploadSuccess = null;
    this.finalizeFailed = false;
    this.cancelRequested = false;
    this.uploading = true;
    try {
      const uploaded = await this.createAndUpload();
      if (!uploaded) {
        return;
      }
      try {
        await this.finalizeUpload();
      } catch {
        this.finalizeFailed = true;
        this.formError = FINALIZE_FAILURE;
        this.focusHeading();
        return;
      }
      this.resetForm();
      this.uploadSuccess = `Saved "${title}".`;
      this.focusHeading();
    } catch (error) {
      if (this.cancelRequested) {
        this.cancelRequested = false;
        return;
      }
      this.formError = this.uploadErrorMessage(error);
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
    const title = this.video.title.trim();
    this.uploading = true;
    this.formError = null;
    this.progressMessage = 'Saving record...';
    try {
      await this.mediaUpload.retryFinalize();
      this.resetForm();
      this.uploadSuccess = `Saved "${title}".`;
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
    this.storageName = batch.storageName || this.storageName;
    this.uploading = true;
    this.formError = null;
    this.uploadSuccess = null;
    this.progressMessage = 'Saving record...';
    try {
      await this.finalizeBatch(batch.batchId);
      const title = this.video.title.trim() || batch.storageName;
      this.resetForm();
      this.uploadSuccess = `Saved "${title}".`;
      this.focusHeading();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'upload-not-found' && this.selectedVideoFile) {
        try {
          this.finalizeFailed = false;
          await this.uploadAssets(batch.batchId);
          await this.finalizeUpload(batch.batchId);
          const title = this.video.title.trim() || batch.storageName;
          this.resetForm();
          this.uploadSuccess = `Saved "${title}".`;
          this.focusHeading();
        } catch {
          this.finalizeFailed = true;
          this.formError = FINALIZE_FAILURE;
        }
      } else if (code === 'upload-not-found') {
        this.formError = 'Choose an MP4 file.';
        this.focusFirstInvalid();
      } else {
        this.finalizeFailed = true;
        this.formError = FINALIZE_FAILURE;
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
      this.authoritativeKeys = null;
      this.pathProvisional = true;
    }
  }

  // EDIT AND DELETE

  async onDeleteSelectedMedia(media: UploadableMedia): Promise<void> {
    const title = media.title || media.fileName || 'this video';
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete video?',
      message: `Delete "${title}"? This cannot be undone.`,
      confirmLabel: 'Delete video',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.deleteError = null;
    try {
      await this.mediaUpload.deleteRecord(media.id);
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
    const needsFile = this.showsFileControls();
    if (needsFile) {
      if (!this.selectedVideoFile) {
        return 'Choose an MP4 file.';
      }
      const fileError = this.videoFileError(this.selectedVideoFile);
      if (fileError) {
        return fileError;
      }
    }
    if (!this.video.title?.trim()) {
      return 'Enter the title before uploading.';
    }
    if (!this.video.date?.trim()) {
      return 'Enter the date before uploading.';
    }
    if (!this.isEditing()) {
      if (!this.storageName?.trim()) {
        return 'Enter a storage name.';
      }
      if (!isValidVideoStorageName(this.storageName)) {
        return 'Use only lowercase letters, numbers, and single dashes in the storage name.';
      }
    }
    if (!this.isEditing() && !this.thumbnailBlob) {
      return 'Choose a thumbnail image.';
    }
    return null;
  }

  private videoFileError(file: File): string | null {
    if (!file.name.toLowerCase().endsWith('.mp4')) {
      return 'Choose an MP4 file.';
    }
    if (file.type && file.type !== 'video/mp4') {
      return 'Choose an MP4 file.';
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return 'That file is larger than 2 GB.';
    }
    return null;
  }

  // UPLOAD PIPELINE

  private async createAndUpload(): Promise<boolean> {
    const request = this.createRequest();
    const response = await this.mediaUpload.createBatch(request);
    this.batchId = response.batchId;
    this.resumeBatch = null;
    if (this.cancelRequested) {
      await this.mediaUpload.cancelBatch(response.batchId);
      this.mediaUpload.clearBatchState(response.batchId);
      this.batchId = null;
      return false;
    }
    if (response.keys.video) {
      this.authoritativeKeys = response.keys.video;
      this.pathProvisional = false;
    }
    await this.uploadAssets(response.batchId);
    return true;
  }

  private createRequest(): CreateMediaUploadRequest {
    const file = this.selectedVideoFile as File;
    const thumbnail = this.thumbnailFile();
    return {
      kind: 'video',
      mode: this.isEditing() && this.replaceFile ? 'replace' : 'create',
      ...(this.isEditing() ? { mediaId: this.video.id } : {}),
      video: {
        storageName: this.storageName,
        sourceFileName: file.name,
        size: file.size,
        contentType: 'video/mp4',
        ...(thumbnail
          ? {
              thumbnail: {
                sourceFileName: thumbnail.name,
                size: thumbnail.size,
                contentType: 'image/jpeg' as const,
              },
            }
          : {}),
      },
    };
  }

  private async uploadAssets(batchId: string): Promise<void> {
    const roles: Array<'video' | 'thumbnail'> = ['video'];
    if (this.thumbnailBlob) {
      roles.push('thumbnail');
    }

    for (const role of roles) {
      if (this.mediaUpload.isAssetCompleted(batchId, { role })) {
        continue;
      }
      const file = role === 'video' ? this.selectedVideoFile : this.thumbnailFile();
      if (!file) {
        if (role === 'video') {
          throw new Error('Choose an MP4 file.');
        }
        continue;
      }
      const [ticket] = await this.mediaUpload.resume(batchId, role);
      if (!ticket) {
        continue;
      }
      this.showProgress(role, null);
      await this.uploadTicket(ticket, file, role);
    }
  }

  private uploadTicket(
    ticket: ClientMediaUploadTicket,
    file: File,
    role: 'video' | 'thumbnail',
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const stream =
        ticket.mode === 'single'
          ? this.mediaUpload.putSingle(ticket, file)
          : this.mediaUpload.putParts(ticket, file);
      this.cancelReject = reject;
      this.uploadSubscription = stream.subscribe({
        next: (progress: UploadProgress) => this.showProgress(role, progress),
        error: reject,
        complete: () => {
          this.cancelReject = undefined;
          this.uploadSubscription = undefined;
          resolve();
        },
      });
    });
  }

  private showProgress(role: 'video' | 'thumbnail', progress: UploadProgress | null): void {
    if (role === 'thumbnail') {
      this.progressMessage = 'Uploading thumbnail...';
      return;
    }
    const event = progress ?? { loaded: 0, total: 0, percent: 0 };
    this.progressMessage = event.partNumber && event.partCount
      ? `Uploading video ${event.percent}% (part ${event.partNumber} of ${event.partCount}).`
      : `Uploading video ${event.percent}%.`;
  }

  private async finalizeUpload(batchId = this.batchId): Promise<void> {
    if (!batchId) {
      throw new Error('No upload is waiting to be saved.');
    }
    this.progressMessage = 'Saving record...';
    try {
      await this.mediaUpload.finalize({
        batchId,
        metadata: {
          title: this.video.title.trim(),
          date: this.video.date,
          isSticky: this.video.isSticky,
          isHidden: this.video.isHidden,
          duration: this.video.duration || '',
        },
      });
    } finally {
      this.progressMessage = '';
    }
  }

  private finalizeBatch(batchId: string): Promise<unknown> {
    return this.mediaUpload.finalize({
      batchId,
      metadata: {
        title: this.video.title?.trim() || this.storageName,
        date: this.video.date || this.currentYear(),
        isSticky: this.video.isSticky,
        isHidden: this.video.isHidden,
        duration: this.video.duration || '',
      },
    });
  }

  private async saveMetadata(): Promise<void> {
    const error = this.metadataValidationError();
    if (error) {
      this.formError = error;
      this.uploadSuccess = null;
      this.focusFirstInvalid();
      return;
    }

    const title = this.video.title.trim();
    this.formError = null;
    this.uploadSuccess = null;
    this.uploading = true;
    this.progressMessage = 'Saving record...';
    try {
      await this.mediaUpload.updateMetadata({
        mediaId: this.video.id,
        title,
        date: this.video.date,
        isSticky: this.video.isSticky,
        isHidden: this.video.isHidden,
        duration: this.video.duration || '',
      });
      this.resetForm();
      this.uploadSuccess = `Saved "${title}".`;
      this.focusHeading();
    } catch (error) {
      this.formError = (error as Error)?.message || uploadFailureMessage(this.video.fileName);
      this.focusFirstInvalid();
    } finally {
      this.uploading = false;
      this.progressMessage = '';
    }
  }

  private metadataValidationError(): string | null {
    if (!this.video.title?.trim()) {
      return 'Enter the title before uploading.';
    }
    if (!this.video.date?.trim()) {
      return 'Enter the date before uploading.';
    }
    return null;
  }

  private uploadErrorMessage(error: unknown): string {
    const code = (error as { code?: string })?.code;
    if (code === 'already-exists') {
      return (error as Error).message;
    }
    if (error instanceof MediaUploadError) {
      return error.message;
    }
    if ((error as Error)?.message === 'Choose an MP4 file.') {
      return 'Choose an MP4 file.';
    }
    return uploadFailureMessage(this.selectedVideoFile?.name);
  }

  // THUMBNAIL HELPERS

  private async loadSelectedVideo(): Promise<void> {
    const file = this.selectedVideoFile;
    if (!file) {
      return;
    }
    this.captureFailed = false;
    try {
      this.releaseVideoObjectUrl();
      const video = await this.createVideoElement(file);
      this.thumbnailVideo = video;
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        this.thumbnailCaptureFailed();
        return;
      }
      this.durationSeconds = duration;
      this.thumbnailTime = thumbnailSeekTime(duration);
      this.video.duration = this.formatDuration(duration);
      const blob = await this.captureInitialFrame(video);
      this.setThumbnail(blob);
      if (!blob) {
        this.thumbnailCaptureFailed();
      }
    } catch {
      this.thumbnailCaptureFailed();
    }
  }

  protected async createVideoElement(file: File): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    this.videoObjectUrl = this.objectUrl(file);
    video.preload = 'metadata';
    video.muted = true;
    if (this.videoObjectUrl) {
      video.src = this.videoObjectUrl;
    }
    await this.waitForLoadedMetadata(video);
    return video;
  }

  protected captureInitialFrame(video: HTMLVideoElement): Promise<Blob | null> {
    return captureVideoThumbnail(video);
  }

  private async captureFrameAt(
    video: HTMLVideoElement,
    time: number,
  ): Promise<Blob | null> {
    try {
      const frameReady =
        typeof video.requestVideoFrameCallback === 'function'
          ? new Promise<void>((resolve) =>
              video.requestVideoFrameCallback(() => resolve()),
            )
          : this.waitForEvent(video, 'seeked');
      video.currentTime = time;
      await frameReady;
      return this.renderVideoFrame(video);
    } catch {
      return null;
    }
  }

  protected renderVideoFrame(video: HTMLVideoElement): Promise<Blob | null> {
    const size = scaleToThumbnail(video.videoWidth, video.videoHeight);
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
    context.drawImage(video, 0, 0, size.width, size.height);
    return encodeJpeg(canvas);
  }

  protected decodeImage(file: File): Promise<HTMLImageElement> {
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

  protected renderImage(image: HTMLImageElement): Promise<Blob | null> {
    const size = scaleToThumbnail(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
    );
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
    return encodeJpeg(canvas);
  }

  private thumbnailCaptureFailed(): void {
    this.setThumbnail(null);
    this.captureFailed = true;
    this.formError = THUMBNAIL_FAILURE;
  }

  private setThumbnail(blob: Blob | null): void {
    if (this.previewObjectUrl) {
      this.revokeObjectUrl(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
    this.thumbnailBlob = blob;
    if (blob) {
      this.previewObjectUrl = this.objectUrl(blob);
    }
    this.thumbnailPreviewUrl = this.previewObjectUrl || this.video?.urls?.icon || null;
  }

  private thumbnailFile(): File | null {
    if (!this.thumbnailBlob) {
      return null;
    }
    return new File([this.thumbnailBlob], `${this.storageName || 'thumbnail'}.jpg`, {
      type: 'image/jpeg',
    });
  }

  private waitForLoadedMetadata(video: HTMLVideoElement): Promise<void> {
    if (video.readyState >= 1) {
      return Promise.resolve();
    }
    return this.waitForEvent(video, 'loadedmetadata');
  }

  private waitForEvent(target: HTMLVideoElement, event: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        target.removeEventListener(event, onEvent);
        target.removeEventListener('error', onError);
      };
      const onEvent = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('media error'));
      };
      target.addEventListener(event, onEvent, { once: true });
      target.addEventListener('error', onError, { once: true });
    });
  }

  // RESET AND FOCUS

  private resetForm(): void {
    this.releaseObjectUrls();
    this.video = new Video();
    this.video.date = this.currentYear();
    this.storageName = '';
    this.selectedVideoFile = null;
    this.thumbnailBlob = null;
    this.thumbnailPreviewUrl = null;
    this.thumbnailVideo = null;
    this.durationSeconds = 0;
    this.thumbnailTime = 0;
    this.captureFailed = false;
    this.replaceFile = false;
    this.finalizeFailed = false;
    this.batchId = null;
    this.authoritativeKeys = null;
    this.pathProvisional = true;
    this.progressMessage = '';
    if (this.videoFileInput) {
      this.videoFileInput.nativeElement.value = '';
    }
    if (this.thumbnailInput) {
      this.thumbnailInput.nativeElement.value = '';
    }
  }

  private releaseObjectUrls(): void {
    this.releaseVideoObjectUrl();
    if (this.previewObjectUrl) {
      this.revokeObjectUrl(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  private releaseVideoObjectUrl(): void {
    if (this.videoObjectUrl) {
      this.revokeObjectUrl(this.videoObjectUrl);
      this.videoObjectUrl = null;
    }
  }

  private revokeObjectUrl(url: string): void {
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }

  private focusHeading(): void {
    this.videoCardHeading?.nativeElement.focus();
  }

  private focusFirstInvalid(): void {
    const message = this.formError;
    const target =
      message?.startsWith('Choose an MP4')
        ? this.videoFileInput?.nativeElement
        : message?.startsWith('Enter the title')
          ? this.titleInput?.nativeElement
          : message?.startsWith('Enter the date')
            ? this.dateInput?.nativeElement
            : message?.startsWith('Enter a storage') ||
                message?.startsWith('Use only lowercase')
              ? this.storageNameInput?.nativeElement
              : message?.startsWith('Choose a thumbnail')
                ? this.thumbnailInput?.nativeElement
                : this.videoCardHeading?.nativeElement;
    target?.focus();
  }

  // SMALL HELPERS

  private currentYear(): string {
    return String(new Date().getFullYear());
  }

  private titleFromFileName(fileName: string): string {
    return fileName
      .replace(/\.[^./\\]*$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
  }

  private formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '';
    }
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(remainder)}`
      : `${minutes}:${pad(remainder)}`;
  }

  private editStorageName(media: Video): string {
    if (media?.storage?.key) {
      return media.storage.key.replace(/^Video\//, '').replace(/\.mp4$/, '');
    }
    return videoStorageName(media?.fileName || '');
  }

  private objectUrl(blob: Blob): string | null {
    try {
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
}
