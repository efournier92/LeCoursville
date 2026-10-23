import { HttpClient, HttpErrorResponse, HttpEventType, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, Subject, from, throwError } from "rxjs";
import { catchError, filter, map, mergeMap, retry, takeUntil, tap } from "rxjs/operators";
import { CloudFunctionsService } from "src/app/services/cloud-functions.service";

export type MediaKind = "video" | "audio-album";
export type MediaMode = "create" | "replace";
export type MediaAssetRole = "video" | "thumbnail" | "track" | "cover" | "zip";

export interface CreateMediaUploadRequest {
  kind: MediaKind;
  mode: MediaMode;
  mediaId?: string;
  video?: {
    storageName: string;
    sourceFileName: string;
    size: number;
    contentType: "video/mp4";
    thumbnail?: { sourceFileName: string; size: number; contentType: "image/jpeg" };
  };
  album?: {
    folderName: string;
    cover: { size: number; contentType: "image/jpeg" };
    zip: { size: number; contentType: "application/zip" };
    tracks: Array<{
      sourceFileName: string;
      title: string;
      size: number;
      contentType: "audio/mpeg";
    }>;
  };
}

export interface CreateMediaUploadResponse {
  batchId: string;
  keys: {
    video?: { key: string; iconKey: string };
    album?: {
      folder: string;
      coverKey: string;
      zipKey: string;
      tracks: Array<{ key: string; title: string }>;
    };
  };
  firstAsset: { role: MediaAssetRole; trackIndex?: number };
}

export interface MediaUploadPartTicket {
  partNumber: number;
  url: string;
  headers: Record<string, string>;
}

export interface SinglePutTicket {
  role: MediaAssetRole;
  key: string;
  mode: "single";
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: number;
}

export interface MultipartUploadTicket {
  role: MediaAssetRole;
  key: string;
  mode: "multipart";
  uploadId: string;
  partSize: number;
  partCount: number;
  parts: MediaUploadPartTicket[];
}

export type MediaUploadTicket = SinglePutTicket | MultipartUploadTicket;
export type ClientMediaUploadTicket = MediaUploadTicket & {
  batchId?: string;
  trackIndex?: number;
};

export interface ResumeVerification {
  exists: boolean;
  batchMatches: boolean;
  size?: number;
  contentType?: string;
}

export interface ResumeMediaUploadRequest {
  batchId: string;
  role: MediaAssetRole;
  trackIndex?: number;
  partNumbers?: number[];
  verifyOnly?: boolean;
}

export interface ResumeMediaUploadResponse {
  uploads: MediaUploadTicket[];
  verification?: ResumeVerification;
}

export interface MediaUploadPart {
  role: MediaAssetRole;
  trackIndex?: number;
  partNumber: number;
  etag: string;
}

export interface FinalizeMediaUploadRequest {
  batchId: string;
  metadata: {
    title: string;
    date: string;
    artist?: string;
    isSticky?: boolean;
    isHidden?: boolean;
    duration?: string;
  };
  trackTitles?: string[];
  parts?: MediaUploadPart[];
}

export interface FinalizeMediaUploadResponse {
  id: string;
  record: unknown;
}

export interface UpdateMediaMetadataRequest {
  mediaId: string;
  title: string;
  date: string;
  isSticky: boolean;
  isHidden: boolean;
  duration?: string;
  trackTitles?: string[];
  listing?: string[];
}

export interface UpdateMediaMetadataResponse {
  record: unknown;
  tracks?: unknown[];
}

export type DeleteMediaRequest = { mediaId: string } | { batchId: string };

export interface DeleteMediaResponse {
  id?: string;
  batchId?: string;
  objectsDeleted: number;
  warnings?: string[];
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  partNumber?: number;
  partCount?: number;
  parts?: MediaUploadPart[];
}

export interface StoredMediaBatch {
  batchId: string;
  kind: MediaKind;
  mode: MediaMode;
  storageName: string;
  folderName: string;
  createdAt: number;
  // Files do not survive a reload, so the finalize payload and the track order
  // are persisted here to let a resumed album finish without re-uploading.
  metadata?: {
    title: string;
    date: string;
    isSticky: boolean;
    isHidden: boolean;
    duration?: string;
  };
  trackTitles?: string[];
  trackFileNames?: string[];
}

export interface AssetRef {
  role: MediaAssetRole;
  trackIndex?: number;
}

export const SESSION_BATCH_PREFIX = "mediaUploadBatch:";
export const REPLACE_STALE_MESSAGE =
  "The file changed while you were replacing it. Retry the upload.";
export const PERMISSION_DENIED_MESSAGE = "You do not have permission to upload media.";
export const RATE_LIMIT_MESSAGE = "Too many uploads. Try again later.";

export class MediaUploadError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly ticket?: ClientMediaUploadTicket
  ) {
    super(message);
    this.name = "MediaUploadError";
  }
}

export function duplicateMessage(key: string): string {
  return `A record named "${key}" already exists. Delete it or choose a different name.`;
}

export function uploadFailureMessage(fileName?: string): string {
  return fileName
    ? `Couldn't upload "${fileName}". Check your connection and try again.`
    : "Couldn't upload the file. Check your connection and try again.";
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" ? code.replace(/^functions\//, "") : "";
}

function errorText(error: unknown): string {
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" ? message : "";
}

export function mapMediaError(
  error: unknown,
  context: { key?: string; fileName?: string } = {}
): MediaUploadError {
  if (error instanceof MediaUploadError) {
    return error;
  }
  const code = errorCode(error);
  const message = errorText(error);
  switch (code) {
    case "already-exists":
      return new MediaUploadError(
        message || duplicateMessage(context.key ?? context.fileName ?? ""),
        code
      );
    case "permission-denied":
      return new MediaUploadError(PERMISSION_DENIED_MESSAGE, code);
    case "resource-exhausted":
      return new MediaUploadError(message || RATE_LIMIT_MESSAGE, code);
    case "failed-precondition":
      if (/Upload not found/i.test(message)) {
        return new MediaUploadError(message, "upload-not-found");
      }
      return new MediaUploadError(message || uploadFailureMessage(context.fileName), code);
    default:
      return new MediaUploadError(uploadFailureMessage(context.fileName), code || "upload-failed");
  }
}

function assetKey(asset: AssetRef): string {
  return `${asset.role}:${asset.trackIndex ?? ""}`;
}

function progressEvent(
  loaded: number,
  total: number,
  partNumber?: number,
  partCount?: number,
  parts?: MediaUploadPart[]
): UploadProgress {
  const safeTotal = total > 0 ? total : 0;
  return {
    loaded,
    total: safeTotal,
    percent: safeTotal > 0 ? Math.min(100, Math.round((loaded / safeTotal) * 100)) : 0,
    ...(partNumber !== undefined ? { partNumber } : {}),
    ...(partCount !== undefined ? { partCount } : {}),
    ...(parts ? { parts } : {}),
  };
}

@Injectable({ providedIn: "root" })
export class MediaUploadService {
  private readonly completed = new Map<string, Set<string>>();
  private readonly collectedParts = new Map<string, MediaUploadPart[]>();
  private readonly cancelRequests = new Map<string, Promise<DeleteMediaResponse>>();
  private pendingFinalize: FinalizeMediaUploadRequest | null = null;

  constructor(
    private cloud: CloudFunctionsService,
    private http: HttpClient
  ) {}

  async createBatch(request: CreateMediaUploadRequest): Promise<CreateMediaUploadResponse> {
    let response: CreateMediaUploadResponse;
    try {
      response = await this.cloud.createMediaUpload(request);
    } catch (error) {
      throw mapMediaError(error, {
        fileName: request.video?.sourceFileName,
        key: request.video?.storageName,
      });
    }
    this.rememberBatch({
      batchId: response.batchId,
      kind: request.kind,
      mode: request.mode,
      storageName: request.video?.storageName ?? "",
      folderName: request.album?.folderName ?? "",
      createdAt: Date.now(),
    });
    return response;
  }

  async resume(
    batchId: string,
    role: MediaAssetRole,
    trackIndex?: number,
    partNumbers?: number[]
  ): Promise<ClientMediaUploadTicket[]> {
    try {
      const response = await this.cloud.resumeMediaUpload({
        batchId,
        role,
        ...(trackIndex !== undefined ? { trackIndex } : {}),
        ...(partNumbers ? { partNumbers } : {}),
      });
      return response.uploads.map(ticket => ({
        ...ticket,
        batchId,
        ...(trackIndex !== undefined ? { trackIndex } : {}),
      }));
    } catch (error) {
      throw mapMediaError(error);
    }
  }

  putSingle(ticket: ClientMediaUploadTicket, file: File): Observable<UploadProgress> {
    if (ticket.mode !== "single") {
      return throwError(() => new MediaUploadError("Expected a single PUT ticket.", "invalid-ticket"));
    }
    const total = file.size;
    return new Observable<UploadProgress>(subscriber => {
      let completed = false;
      let failed = false;
      const subscription = this.http
        .put(ticket.url, file, {
          headers: ticket.headers,
          observe: "events",
          reportProgress: true,
          responseType: "text",
        })
        .subscribe({
          next: event => {
            if (event.type === HttpEventType.UploadProgress) {
              subscriber.next(progressEvent(event.loaded, total));
            }
          },
          error: (error: HttpErrorResponse) => {
            failed = true;
            void this.handleSingleError(ticket, error, file.name).then(
              () => {
                if (subscriber.closed) {
                  return;
                }
                completed = true;
                this.markAssetCompleted(ticket);
                subscriber.next(progressEvent(total, total));
                subscriber.complete();
              },
              mapped => {
                if (!subscriber.closed) {
                  subscriber.error(mapped);
                }
              }
            );
          },
          complete: () => {
            if (failed || subscriber.closed) {
              return;
            }
            completed = true;
            this.markAssetCompleted(ticket);
            subscriber.next(progressEvent(total, total));
            subscriber.complete();
          },
        });

      return () => {
        subscription.unsubscribe();
        if (!completed && !failed) {
          this.cancelIncomplete(ticket);
        }
      };
    });
  }

  putParts(ticket: ClientMediaUploadTicket, file: File): Observable<UploadProgress> {
    if (ticket.mode !== "multipart") {
      return throwError(() => new MediaUploadError("Expected a multipart ticket.", "invalid-ticket"));
    }
    const total = file.size;

    return new Observable<UploadProgress>(subscriber => {
      const loadedByPart = new Map<number, number>();
      const collected: MediaUploadPart[] = [];
      const stop = new Subject<void>();
      const emitProgress = (partNumber: number): void => {
        const loaded = [...loadedByPart.values()].reduce((sum, value) => sum + value, 0);
        subscriber.next(progressEvent(loaded, total, partNumber, ticket.partCount));
      };
      let completed = false;
      let failed = false;

      const uploadPart = (partNumber: number) =>
        from(this.partTicket(ticket, partNumber)).pipe(
          mergeMap(part => {
            const start = (partNumber - 1) * ticket.partSize;
            const end = Math.min(start + ticket.partSize, total);
            const chunk = file.slice(start, end);
            return this.http
              .put(part.url, chunk, {
                headers: part.headers ?? {},
                observe: "events",
                reportProgress: true,
                responseType: "text",
              })
              .pipe(
                tap(event => {
                  if (event.type === HttpEventType.UploadProgress) {
                    loadedByPart.set(partNumber, Math.min(event.loaded, end - start));
                    emitProgress(partNumber);
                  }
                }),
                filter(event => event.type === HttpEventType.Response),
                map(event => ({
                  partNumber,
                  etag: (event as HttpResponse<unknown>).headers.get("ETag") ?? "",
                })),
                retry(2)
              );
          }),
          tap(part => {
            const start = (partNumber - 1) * ticket.partSize;
            const end = Math.min(start + ticket.partSize, total);
            loadedByPart.set(partNumber, end - start);
            collected.push({
              role: ticket.role,
              ...(ticket.trackIndex !== undefined ? { trackIndex: ticket.trackIndex } : {}),
              partNumber: part.partNumber,
              etag: part.etag,
            });
          }),
          catchError(error =>
            throwError(() => mapMediaError(error, { fileName: file.name, key: ticket.key }))
          )
        );

      const subscription = from(
        Array.from({ length: ticket.partCount }, (_, index) => index + 1)
      )
        .pipe(
          mergeMap(partNumber => uploadPart(partNumber), 3),
          takeUntil(stop)
        )
        .subscribe({
          next: () => {},
          error: error => {
            failed = true;
            subscriber.error(error);
          },
          complete: () => {
            if (failed) {
              return;
            }
            completed = true;
            const parts = [...collected].sort((a, b) => a.partNumber - b.partNumber);
            this.storeParts(ticket, parts);
            this.markAssetCompleted(ticket);
            subscriber.next(progressEvent(total, total, undefined, ticket.partCount, parts));
            subscriber.complete();
          },
        });

      return () => {
        stop.next();
        stop.complete();
        subscription.unsubscribe();
        if (!completed && !failed) {
          this.cancelIncomplete(ticket);
        }
      };
    });
  }

  async finalize(request: FinalizeMediaUploadRequest): Promise<FinalizeMediaUploadResponse> {
    const collected = this.partsFor(request.batchId);
    const payload: FinalizeMediaUploadRequest =
      request.parts && request.parts.length > 0
        ? request
        : { ...request, ...(collected.length > 0 ? { parts: collected } : {}) };
    this.pendingFinalize = payload;
    try {
      const result = await this.cloud.finalizeMediaUpload(payload);
      this.pendingFinalize = null;
      this.clearBatchState(request.batchId);
      return result;
    } catch (error) {
      throw mapMediaError(error);
    }
  }

  retryFinalize(): Promise<FinalizeMediaUploadResponse> {
    const pending = this.pendingFinalize;
    if (!pending) {
      return Promise.reject(new MediaUploadError("No upload is waiting to be saved.", "no-finalize"));
    }
    return this.cloud
      .finalizeMediaUpload(pending)
      .then(result => {
        this.clearBatchState(pending.batchId);
        return result;
      })
      .catch(error => Promise.reject(mapMediaError(error)));
  }

  canRetryFinalize(): boolean {
    return this.pendingFinalize !== null;
  }

  async updateMetadata(
    request: UpdateMediaMetadataRequest
  ): Promise<UpdateMediaMetadataResponse> {
    try {
      return await this.cloud.updateMediaMetadata(request);
    } catch (error) {
      throw mapMediaError(error);
    }
  }

  async deleteRecord(mediaId: string): Promise<DeleteMediaResponse> {
    try {
      return await this.cloud.deleteMedia({ mediaId });
    } catch (error) {
      throw mapMediaError(error);
    }
  }

  cancelBatch(batchId: string): Promise<DeleteMediaResponse> {
    // Unsubscribing an upload and the component's Cancel both request cleanup;
    // one server call per batch keeps the second request from seeing "not found".
    const existing = this.cancelRequests.get(batchId);
    if (existing) {
      return existing;
    }
    const request = this.cloud
      .deleteMedia({ batchId })
      .then(result => {
        this.clearBatchState(batchId);
        return result;
      })
      .catch(error => {
        this.cancelRequests.delete(batchId);
        throw mapMediaError(error);
      });
    this.cancelRequests.set(batchId, request);
    return request;
  }

  rememberBatch(batch: StoredMediaBatch): void {
    try {
      sessionStorage.setItem(`${SESSION_BATCH_PREFIX}${batch.batchId}`, JSON.stringify(batch));
    } catch {
      // Session storage can be unavailable in private browsing; resume is then unavailable.
    }
  }

  forgetBatch(batchId: string): void {
    try {
      sessionStorage.removeItem(`${SESSION_BATCH_PREFIX}${batchId}`);
    } catch {
      // Ignore storage failures.
    }
  }

  pendingBatch(): StoredMediaBatch | null {
    try {
      for (let index = 0; index < sessionStorage.length; index++) {
        const key = sessionStorage.key(index);
        if (!key?.startsWith(SESSION_BATCH_PREFIX)) {
          continue;
        }
        const raw = sessionStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw) as StoredMediaBatch;
        if (parsed?.batchId) {
          return parsed;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  markAssetCompleted(ticket: { batchId?: string; role: MediaAssetRole; trackIndex?: number }): void {
    if (!ticket.batchId) {
      return;
    }
    const set = this.completed.get(ticket.batchId) ?? new Set<string>();
    set.add(assetKey(ticket));
    this.completed.set(ticket.batchId, set);
  }

  isAssetCompleted(batchId: string, asset: AssetRef): boolean {
    return this.completed.get(batchId)?.has(assetKey(asset)) ?? false;
  }

  incompleteAssets(batchId: string, assets: AssetRef[]): AssetRef[] {
    return assets.filter(asset => !this.isAssetCompleted(batchId, asset));
  }

  clearBatchState(batchId: string): void {
    if (!batchId) {
      return;
    }
    this.forgetBatch(batchId);
    this.completed.delete(batchId);
    for (const key of [...this.collectedParts.keys()]) {
      if (key.startsWith(`${batchId}|`)) {
        this.collectedParts.delete(key);
      }
    }
    if (this.pendingFinalize?.batchId === batchId) {
      this.pendingFinalize = null;
    }
  }

  private async handleSingleError(
    ticket: ClientMediaUploadTicket,
    error: HttpErrorResponse,
    fileName?: string
  ): Promise<void> {
    const headers = ticket.mode === "single" ? ticket.headers : {};
    const replace = Object.keys(headers).some(name => name.toLowerCase() === "if-match");
    if (error.status === 412 && ticket.batchId) {
      if (replace) {
        const fresh = await this.resume(ticket.batchId, ticket.role, ticket.trackIndex);
        throw new MediaUploadError(REPLACE_STALE_MESSAGE, "replace-stale", fresh[0]);
      }
      const verification = await this.cloud.resumeMediaUpload({
        batchId: ticket.batchId,
        role: ticket.role,
        ...(ticket.trackIndex !== undefined ? { trackIndex: ticket.trackIndex } : {}),
        verifyOnly: true,
      });
      if (verification.verification?.batchMatches) {
        return;
      }
      throw new MediaUploadError(duplicateMessage(ticket.key), "already-exists");
    }
    throw new MediaUploadError(uploadFailureMessage(fileName), "upload-failed");
  }

  private async partTicket(
    ticket: ClientMediaUploadTicket,
    partNumber: number
  ): Promise<MediaUploadPartTicket> {
    if (ticket.mode !== "multipart") {
      throw new MediaUploadError("Expected a multipart ticket.", "invalid-ticket");
    }
    const existing = ticket.parts.find(part => part.partNumber === partNumber);
    if (existing) {
      return existing;
    }
    if (!ticket.batchId) {
      throw new MediaUploadError("Part ticket is missing.", "invalid-ticket");
    }
    const uploads = await this.resume(
      ticket.batchId,
      ticket.role,
      ticket.trackIndex,
      [partNumber]
    );
    const multipart = uploads.find(
      upload => upload.mode === "multipart" && upload.parts.some(part => part.partNumber === partNumber)
    );
    const part =
      multipart?.mode === "multipart"
        ? multipart.parts.find(entry => entry.partNumber === partNumber)
        : undefined;
    if (!part) {
      throw new MediaUploadError("Part ticket is missing.", "invalid-ticket");
    }
    return part;
  }

  private storeParts(ticket: ClientMediaUploadTicket, parts: MediaUploadPart[]): void {
    if (!ticket.batchId) {
      return;
    }
    this.collectedParts.set(
      `${ticket.batchId}|${assetKey(ticket)}`,
      parts
    );
  }

  private partsFor(batchId: string): MediaUploadPart[] {
    const parts: MediaUploadPart[] = [];
    for (const [key, value] of this.collectedParts.entries()) {
      if (key.startsWith(`${batchId}|`)) {
        parts.push(...value);
      }
    }
    return parts;
  }

  private cancelIncomplete(ticket: ClientMediaUploadTicket): void {
    if (!ticket.batchId) {
      return;
    }
    void this.cancelBatch(ticket.batchId).catch(() => {});
  }
}
