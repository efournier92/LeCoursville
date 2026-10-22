export type MediaKind = "video" | "audio-album";
export type MediaMode = "create" | "replace";
export type MediaAssetRole = "video" | "thumbnail" | "track" | "cover" | "zip";
export type MediaBatchStatus = "ticketed" | "finalizing" | "finalized";

export interface MediaBatchPart {
  partNumber: number;
  etag: string;
}

export interface MediaBatchAsset {
  role: MediaAssetRole;
  key: string;
  contentType: string;
  size: number;
  multipart: boolean;
  uploadId: string | null;
  parts: MediaBatchPart[];
}

export interface MediaUploadBatch {
  kind: MediaKind;
  mode: MediaMode;
  mediaId: string | null;
  uid: string;
  createdAt: number;
  lastActivityAt: number;
  status: MediaBatchStatus;
  assets: MediaBatchAsset[];
  resultId: string | null;
  finalizedAt: number | null;
}
