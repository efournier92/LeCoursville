import { HttpEventType } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { vi } from "vitest";
import { CloudFunctionsService } from "src/app/services/cloud-functions.service";
import {
  ClientMediaUploadTicket,
  CreateMediaUploadRequest,
  FinalizeMediaUploadRequest,
  MediaUploadError,
  MediaUploadService,
  REPLACE_STALE_MESSAGE,
  UploadProgress,
  duplicateMessage,
} from "./media-upload.service";

const BATCH = "batch-1";
const SINGLE_URL = "https://s3.example/Video/x.mp4";

function singleTicket(
  overrides: Partial<ClientMediaUploadTicket> = {}
): ClientMediaUploadTicket {
  return {
    role: "video",
    key: "Video/x.mp4",
    mode: "single",
    url: SINGLE_URL,
    method: "PUT",
    headers: { "content-type": "video/mp4", "if-none-match": "*" },
    expiresAt: Date.now() + 900000,
    batchId: BATCH,
    ...overrides,
  } as ClientMediaUploadTicket;
}

function multipartTicket(): ClientMediaUploadTicket {
  return {
    role: "video",
    key: "Video/x.mp4",
    mode: "multipart",
    uploadId: "upload-1",
    partSize: 4,
    partCount: 3,
    parts: [1, 2, 3].map(partNumber => ({
      partNumber,
      url: `https://s3.example/part-${partNumber}`,
      headers: {},
    })),
    batchId: BATCH,
  } as ClientMediaUploadTicket;
}

function fileOf(size: number, name = "x.mp4"): File {
  return new File([new Uint8Array(size)], name, { type: "video/mp4" });
}

const CREATE_REQUEST: CreateMediaUploadRequest = {
  kind: "video",
  mode: "create",
  video: {
    storageName: "x",
    sourceFileName: "x.mp4",
    size: 10,
    contentType: "video/mp4",
  },
};

describe("MediaUploadService", () => {
  let service: MediaUploadService;
  let httpMock: HttpTestingController;
  let cloud: {
    createMediaUpload: ReturnType<typeof vi.fn>;
    resumeMediaUpload: ReturnType<typeof vi.fn>;
    finalizeMediaUpload: ReturnType<typeof vi.fn>;
    updateMediaMetadata: ReturnType<typeof vi.fn>;
    deleteMedia: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sessionStorage.clear();
    cloud = {
      createMediaUpload: vi.fn(),
      resumeMediaUpload: vi.fn(),
      finalizeMediaUpload: vi.fn(),
      updateMediaMetadata: vi.fn(),
      deleteMedia: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MediaUploadService,
        { provide: CloudFunctionsService, useValue: cloud },
      ],
    });
    service = TestBed.inject(MediaUploadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("runs create, resume, single PUT, and finalize in order", async () => {
    cloud.createMediaUpload.mockResolvedValue({
      batchId: BATCH,
      keys: { video: { key: "Video/x.mp4", iconKey: "Video/Icons/x.jpg" } },
      firstAsset: { role: "video" },
    });
    cloud.resumeMediaUpload.mockResolvedValue({ uploads: [singleTicket()] });
    cloud.finalizeMediaUpload.mockResolvedValue({ id: "media-1", record: {} });

    const created = await service.createBatch(CREATE_REQUEST);
    expect(created.batchId).toBe(BATCH);
    expect(service.pendingBatch()).toMatchObject({ batchId: BATCH, storageName: "x" });

    const [ticket] = await service.resume(BATCH, "video");
    expect(ticket.batchId).toBe(BATCH);

    const progress: UploadProgress[] = [];
    const uploaded = new Promise<void>((resolve, reject) => {
      service.putSingle(ticket, fileOf(10)).subscribe({
        next: value => progress.push(value),
        error: reject,
        complete: resolve,
      });
    });
    const request = httpMock.expectOne(SINGLE_URL);
    expect(request.request.method).toBe("PUT");
    expect(request.request.headers.get("if-none-match")).toBe("*");
    request.flush(null, { status: 200, statusText: "OK" });
    await uploaded;

    expect(progress.at(-1)?.percent).toBe(100);
    expect(service.isAssetCompleted(BATCH, { role: "video" })).toBe(true);

    await service.finalize({ batchId: BATCH, metadata: { title: "T", date: "2026" } });
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: BATCH })
    );
  });

  it("slices parts, uploads three at a time, retries twice, and collects ETags in order", async () => {
    const progress: UploadProgress[] = [];
    const result = new Promise<UploadProgress>((resolve, reject) => {
      service.putParts(multipartTicket(), fileOf(10)).subscribe({
        next: value => progress.push(value),
        error: reject,
        complete: () => resolve(progress.at(-1) as UploadProgress),
      });
    });

    await Promise.resolve();
    const part1 = httpMock.expectOne("https://s3.example/part-1");
    const part2 = httpMock.expectOne("https://s3.example/part-2");
    const part3 = httpMock.expectOne("https://s3.example/part-3");
    expect((part1.request.body as Blob).size).toBe(4);
    expect((part2.request.body as Blob).size).toBe(4);
    expect((part3.request.body as Blob).size).toBe(2);

    part1.event({ type: HttpEventType.UploadProgress, loaded: 2, total: 4 });
    expect(progress.some(value => value.percent === 20 && value.partNumber === 1)).toBe(true);

    part2.flush("retry", { status: 500, statusText: "Server Error" });
    const retry1 = httpMock.expectOne("https://s3.example/part-2");
    retry1.flush("retry", { status: 500, statusText: "Server Error" });
    const retry2 = httpMock.expectOne("https://s3.example/part-2");
    retry2.flush(null, { status: 200, statusText: "OK", headers: { ETag: '"etag-2"' } });

    part1.flush(null, { status: 200, statusText: "OK", headers: { ETag: '"etag-1"' } });
    part3.flush(null, { status: 200, statusText: "OK", headers: { ETag: '"etag-3"' } });

    const final = await result;
    expect(final.parts).toEqual([
      { role: "video", partNumber: 1, etag: '"etag-1"' },
      { role: "video", partNumber: 2, etag: '"etag-2"' },
      { role: "video", partNumber: 3, etag: '"etag-3"' },
    ]);
    expect(final.percent).toBe(100);

    cloud.finalizeMediaUpload.mockResolvedValue({ id: "media-1", record: {} });
    await service.finalize({ batchId: BATCH, metadata: { title: "T", date: "2026" } });
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ parts: final.parts })
    );
  });

  it("aborts in-flight requests and cancels the batch on unsubscribe", async () => {
    cloud.deleteMedia.mockResolvedValue({ batchId: BATCH, objectsDeleted: 1 });

    const subscription = service.putSingle(singleTicket(), fileOf(10)).subscribe({
      error: () => {},
    });
    const request = httpMock.expectOne(SINGLE_URL);
    subscription.unsubscribe();

    expect(request.cancelled).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(cloud.deleteMedia).toHaveBeenCalledWith({ batchId: BATCH });

    await service.cancelBatch(BATCH);
    expect(cloud.deleteMedia).toHaveBeenCalledTimes(1);
  });

  it("treats a create-mode 412 as success when verify-only sees its own batch", async () => {
    cloud.resumeMediaUpload.mockResolvedValue({
      uploads: [],
      verification: { exists: true, batchMatches: true },
    });

    let completed = false;
    const uploaded = new Promise<void>((resolve, reject) => {
      service.putSingle(singleTicket(), fileOf(10)).subscribe({
        error: reject,
        complete: () => {
          completed = true;
          resolve();
        },
      });
    });
    const request = httpMock.expectOne(SINGLE_URL);
    request.flush(null, { status: 412, statusText: "Precondition Failed" });
    await uploaded;

    expect(cloud.resumeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: BATCH, role: "video", verifyOnly: true })
    );
    expect(completed).toBe(true);
    expect(service.isAssetCompleted(BATCH, { role: "video" })).toBe(true);
  });

  it("shows the duplicate message on a create-mode 412 from a foreign batch", async () => {
    cloud.resumeMediaUpload.mockResolvedValue({
      uploads: [],
      verification: { exists: true, batchMatches: false },
    });

    const failure = await new Promise<MediaUploadError>(resolve => {
      service.putSingle(singleTicket(), fileOf(10)).subscribe({
        error: error => resolve(error),
      });
      httpMock
        .expectOne(SINGLE_URL)
        .flush(null, { status: 412, statusText: "Precondition Failed" });
    });

    expect(failure.message).toBe(duplicateMessage("Video/x.mp4"));
  });

  it("maps a replace-mode 412 to the stale-content message and re-tickets", async () => {
    const fresh = singleTicket({ headers: { "if-match": '"new"' } });
    cloud.resumeMediaUpload.mockResolvedValue({ uploads: [fresh] });

    const failure = await new Promise<MediaUploadError>(resolve => {
      service
        .putSingle(singleTicket({ headers: { "if-match": '"old"' } }), fileOf(10))
        .subscribe({
          error: (error: MediaUploadError) => resolve(error),
        });
      httpMock
        .expectOne(SINGLE_URL)
        .flush(null, { status: 412, statusText: "Precondition Failed" });
    });

    expect(failure.message).toBe(REPLACE_STALE_MESSAGE);
    expect(
      failure.ticket?.mode === "single" ? failure.ticket.headers["if-match"] : undefined
    ).toBe('"new"');
    expect(cloud.resumeMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: BATCH, role: "video" })
    );
    expect(cloud.resumeMediaUpload).not.toHaveBeenCalledWith(
      expect.objectContaining({ verifyOnly: true })
    );
  });

  it("maps callable errors to the documented messages", async () => {
    cloud.createMediaUpload.mockRejectedValueOnce({
      code: "functions/resource-exhausted",
      message: "Too many uploads. Try again later.",
    });
    await expect(service.createBatch(CREATE_REQUEST)).rejects.toMatchObject({
      message: "Too many uploads. Try again later.",
    });

    cloud.createMediaUpload.mockRejectedValueOnce({
      code: "functions/permission-denied",
      message: "nope",
    });
    await expect(service.createBatch(CREATE_REQUEST)).rejects.toMatchObject({
      message: "You do not have permission to upload media.",
    });

    cloud.createMediaUpload.mockRejectedValueOnce({
      code: "functions/already-exists",
      message: duplicateMessage("Video/x.mp4"),
    });
    await expect(service.createBatch(CREATE_REQUEST)).rejects.toMatchObject({
      message: duplicateMessage("Video/x.mp4"),
    });
  });

  it("keeps a failed finalize retryable without minting a ticket or PUT", async () => {
    cloud.finalizeMediaUpload.mockRejectedValueOnce({
      code: "functions/unavailable",
      message: "down",
    });
    const request: FinalizeMediaUploadRequest = {
      batchId: BATCH,
      metadata: { title: "T", date: "2026" },
    };

    await expect(service.finalize(request)).rejects.toBeInstanceOf(MediaUploadError);
    expect(service.canRetryFinalize()).toBe(true);

    cloud.finalizeMediaUpload.mockResolvedValueOnce({ id: "media-1", record: {} });
    const result = await service.retryFinalize();

    expect(result.id).toBe("media-1");
    expect(cloud.finalizeMediaUpload).toHaveBeenCalledTimes(2);
    expect(cloud.resumeMediaUpload).not.toHaveBeenCalled();
    expect(httpMock.match(() => true)).toEqual([]);
  });

  it("preserves non-upload failed-precondition messages", async () => {
    cloud.finalizeMediaUpload.mockRejectedValueOnce({
      code: "functions/failed-precondition",
      message: "Finalize already in progress.",
    });

    await expect(
      service.finalize({ batchId: BATCH, metadata: { title: "T", date: "2026" } })
    ).rejects.toMatchObject({
      message: "Finalize already in progress.",
      code: "failed-precondition",
    });
  });

  it("remembers a session batch and resumes only assets without a completion marker", async () => {
    cloud.createMediaUpload.mockResolvedValue({
      batchId: BATCH,
      keys: { video: { key: "Video/x.mp4", iconKey: "Video/Icons/x.jpg" } },
      firstAsset: { role: "video" },
    });

    await service.createBatch(CREATE_REQUEST);
    expect(sessionStorage.getItem(`mediaUploadBatch:${BATCH}`)).toContain(BATCH);
    expect(service.pendingBatch()).toMatchObject({
      batchId: BATCH,
      kind: "video",
      mode: "create",
      storageName: "x",
    });

    service.markAssetCompleted({ batchId: BATCH, role: "video" });
    expect(
      service.incompleteAssets(BATCH, [{ role: "video" }, { role: "thumbnail" }])
    ).toEqual([{ role: "thumbnail" }]);

    service.clearBatchState(BATCH);
    expect(service.pendingBatch()).toBeNull();
    expect(service.isAssetCompleted(BATCH, { role: "video" })).toBe(false);
  });
});
