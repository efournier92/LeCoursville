import { randomUUID } from "crypto";
import { deleteSinkObjects, sinkHead } from "../emulator-media-sink";
import {
  MEDIA_AWS_ACCESS_KEY_ID,
  MEDIA_AWS_REGION,
  MEDIA_AWS_SECRET_ACCESS_KEY,
  MEDIA_CLOUDFRONT_DISTRIBUTION_ID,
  MEDIA_S3_BUCKET,
  emulatorMediaUrl,
  isMediaEmulator,
} from "./config";

export interface StorageAdapter {
  presignPut(input: {
    key: string;
    contentType: string;
    batchId: string;
    mode: "create" | "replace";
    etag?: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers: Record<string, string>; expiresAt: number }>;
  createMultipart(input: {
    key: string;
    contentType: string;
    batchId: string;
  }): Promise<{ uploadId: string }>;
  presignParts(input: {
    key: string;
    uploadId: string;
    partNumbers: number[];
    expiresInSeconds: number;
  }): Promise<Array<{ partNumber: number; url: string }>>;
  listParts(
    key: string,
    uploadId: string
  ): Promise<Array<{ partNumber: number; size: number; etag: string }>>;
  completeMultipart(input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
  head(key: string): Promise<{
    exists: boolean;
    size?: number;
    contentType?: string;
    etag?: string;
    metadata?: Record<string, string>;
  }>;
  deleteMany(keys: string[]): Promise<{ deleted: number; warnings: string[] }>;
  invalidate(paths: string[]): Promise<void>;
}

type S3Module = typeof import("@aws-sdk/client-s3");
type PresignerModule = typeof import("@aws-sdk/s3-request-presigner");
type CloudFrontModule = typeof import("@aws-sdk/client-cloudfront");

let s3Module: Promise<S3Module> | null = null;
let presignerModule: Promise<PresignerModule> | null = null;
let cloudFrontModule: Promise<CloudFrontModule> | null = null;
let s3ClientPromise: Promise<InstanceType<S3Module["S3Client"]>> | null = null;
let cloudFrontClientPromise: Promise<
  InstanceType<CloudFrontModule["CloudFrontClient"]>
> | null = null;

function loadS3(): Promise<S3Module> {
  return (s3Module ??= import("@aws-sdk/client-s3"));
}

function loadPresigner(): Promise<PresignerModule> {
  return (presignerModule ??= import("@aws-sdk/s3-request-presigner"));
}

function loadCloudFront(): Promise<CloudFrontModule> {
  return (cloudFrontModule ??= import("@aws-sdk/client-cloudfront"));
}

function awsCredentials() {
  return {
    accessKeyId: MEDIA_AWS_ACCESS_KEY_ID.value(),
    secretAccessKey: MEDIA_AWS_SECRET_ACCESS_KEY.value(),
  };
}

function bucketName(): string {
  return MEDIA_S3_BUCKET.value();
}

function getS3Client(): Promise<InstanceType<S3Module["S3Client"]>> {
  return (s3ClientPromise ??= loadS3().then(
    ({ S3Client }) =>
      new S3Client({
        region: MEDIA_AWS_REGION.value(),
        credentials: awsCredentials(),
      })
  ));
}

function getCloudFrontClient(): Promise<
  InstanceType<CloudFrontModule["CloudFrontClient"]>
> {
  return (cloudFrontClientPromise ??= loadCloudFront().then(
    ({ CloudFrontClient }) =>
      new CloudFrontClient({
        // CloudFront is a global service signed in us-east-1.
        region: "us-east-1",
        credentials: awsCredentials(),
      })
  ));
}

function presignHeaders(input: {
  contentType: string;
  batchId: string;
  mode: "create" | "replace";
  etag?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": input.contentType,
    "x-amz-meta-upload-batch": input.batchId,
  };
  if (input.mode === "replace") {
    if (!input.etag) {
      throw new Error("Replace presign requires an etag.");
    }
    headers["if-match"] = input.etag;
  } else {
    headers["if-none-match"] = "*";
  }
  return headers;
}

function toInvalidationPath(path: string): string {
  const prefixed = path.startsWith("/") ? path : `/${path}`;
  return prefixed.split("/").map((segment) => encodeURI(segment)).join("/");
}

const productionAdapter: StorageAdapter = {
  async presignPut(input) {
    const headers = presignHeaders(input);
    const { PutObjectCommand } = await loadS3();
    const { getSignedUrl } = await loadPresigner();
    const signableHeaders = new Set(["content-type", "x-amz-meta-upload-batch"]);
    if (input.mode === "replace") {
      signableHeaders.add("if-match");
    }
    const command = new PutObjectCommand({
      Bucket: bucketName(),
      Key: input.key,
      ContentType: input.contentType,
      Metadata: { "upload-batch": input.batchId },
      ...(input.mode === "replace"
        ? { IfMatch: input.etag }
        : { IfNoneMatch: "*" }),
    });
    const url = await getSignedUrl(await getS3Client(), command, {
      expiresIn: input.expiresInSeconds,
      signableHeaders,
      // Without this the presigner hoists the metadata into the query string, so S3 would not store it as x-amz-meta-upload-batch.
      unhoistableHeaders: new Set(["x-amz-meta-upload-batch"]),
    });
    return {
      url,
      headers,
      expiresAt: Date.now() + input.expiresInSeconds * 1000,
    };
  },

  async createMultipart(input) {
    const { CreateMultipartUploadCommand } = await loadS3();
    const result = await (
      await getS3Client()
    ).send(
      new CreateMultipartUploadCommand({
        Bucket: bucketName(),
        Key: input.key,
        ContentType: input.contentType,
        Metadata: { "upload-batch": input.batchId },
      })
    );
    if (!result.UploadId) {
      throw new Error("S3 did not return a multipart upload id.");
    }
    return { uploadId: result.UploadId };
  },

  async presignParts(input) {
    const { UploadPartCommand } = await loadS3();
    const { getSignedUrl } = await loadPresigner();
    const client = await getS3Client();
    const bucket = bucketName();
    const parts: Array<{ partNumber: number; url: string }> = [];
    for (const partNumber of input.partNumbers) {
      const url = await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket,
          Key: input.key,
          UploadId: input.uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: input.expiresInSeconds }
      );
      parts.push({ partNumber, url });
    }
    return parts;
  },

  async listParts(key, uploadId) {
    const { ListPartsCommand } = await loadS3();
    const client = await getS3Client();
    const bucket = bucketName();
    const parts: Array<{ partNumber: number; size: number; etag: string }> = [];
    let marker: string | undefined;
    for (;;) {
      const result = await client.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        })
      );
      for (const part of result.Parts ?? []) {
        if (
          part.PartNumber !== undefined &&
          part.Size !== undefined &&
          part.ETag
        ) {
          parts.push({
            partNumber: part.PartNumber,
            size: part.Size,
            etag: part.ETag,
          });
        }
      }
      if (!result.IsTruncated || !result.NextPartNumberMarker) {
        break;
      }
      marker = result.NextPartNumberMarker;
    }
    return parts;
  },

  async completeMultipart(input) {
    const { CompleteMultipartUploadCommand } = await loadS3();
    await (
      await getS3Client()
    ).send(
      new CompleteMultipartUploadCommand({
        Bucket: bucketName(),
        Key: input.key,
        UploadId: input.uploadId,
        MultipartUpload: {
          Parts: input.parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      })
    );
  },

  async abortMultipart(key, uploadId) {
    const { AbortMultipartUploadCommand } = await loadS3();
    await (
      await getS3Client()
    ).send(
      new AbortMultipartUploadCommand({
        Bucket: bucketName(),
        Key: key,
        UploadId: uploadId,
      })
    );
  },

  async head(key) {
    const { HeadObjectCommand } = await loadS3();
    try {
      const result = await (
        await getS3Client()
      ).send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
      return {
        exists: true,
        size: result.ContentLength,
        contentType: result.ContentType,
        etag: result.ETag,
        metadata: result.Metadata,
      };
    } catch (err) {
      if (isNotFound(err)) {
        return { exists: false };
      }
      throw err;
    }
  },

  async deleteMany(keys) {
    const { DeleteObjectsCommand } = await loadS3();
    const client = await getS3Client();
    const bucket = bucketName();
    let deleted = 0;
    const warnings: string[] = [];
    for (let index = 0; index < keys.length; index += 1000) {
      const chunk = keys.slice(index, index + 1000);
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: false,
          },
        })
      );
      deleted += result.Deleted?.length ?? 0;
      for (const error of result.Errors ?? []) {
        warnings.push(`Could not delete "${error.Key ?? ""}".`);
      }
    }
    return { deleted, warnings };
  },

  async invalidate(paths) {
    if (paths.length === 0) {
      return;
    }
    const { CreateInvalidationCommand } = await loadCloudFront();
    const items = paths.map(toInvalidationPath);
    await (
      await getCloudFrontClient()
    ).send(
      new CreateInvalidationCommand({
        DistributionId: MEDIA_CLOUDFRONT_DISTRIBUTION_ID.value(),
        InvalidationBatch: {
          CallerReference: randomUUID(),
          Paths: { Quantity: items.length, Items: items },
        },
      })
    );
  },
};

function isNotFound(err: unknown): boolean {
  const error = err as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey" ||
    error?.$metadata?.httpStatusCode === 404
  );
}

function multipartUnsupported(): never {
  throw new Error("Multipart uploads are not supported in emulator mode.");
}

const emulatorAdapter: StorageAdapter = {
  async presignPut(input) {
    return {
      url: emulatorMediaUrl(input.key),
      headers: presignHeaders(input),
      expiresAt: Date.now() + input.expiresInSeconds * 1000,
    };
  },

  async createMultipart() {
    return multipartUnsupported();
  },

  async presignParts() {
    return multipartUnsupported();
  },

  async listParts() {
    return multipartUnsupported();
  },

  async completeMultipart() {
    return multipartUnsupported();
  },

  async abortMultipart() {
    return multipartUnsupported();
  },

  async head(key) {
    const head = sinkHead(key);
    return head
      ? {
          exists: true,
          size: head.size,
          contentType: head.contentType,
          etag: head.etag,
          metadata: head.metadata,
        }
      : { exists: false };
  },

  async deleteMany(keys) {
    return { deleted: deleteSinkObjects(keys), warnings: [] };
  },

  async invalidate() {
    return;
  },
};

export function getStorageAdapter(): StorageAdapter {
  return isMediaEmulator() ? emulatorAdapter : productionAdapter;
}
