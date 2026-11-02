import { Injectable } from "@angular/core";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { FirebaseService } from "src/app/services/firebase.service";
import { UploaderInfo } from "src/app/models/user-upload";
import type {
  CreateMediaUploadRequest,
  CreateMediaUploadResponse,
  DeleteMediaRequest,
  DeleteMediaResponse,
  FinalizeMediaUploadRequest,
  FinalizeMediaUploadResponse,
  ResumeMediaUploadRequest,
  ResumeMediaUploadResponse,
  UpdateMediaMetadataRequest,
  UpdateMediaMetadataResponse,
} from "src/app/services/media-upload.service";

export interface CreatedUserUpload {
  id: string;
  path: string;
}

export interface AnalyticsTableRow {
  label: string;
  value: number;
}

export interface AnalyticsSummary {
  source: 'fixture' | 'ga';
  totals: { users: number; sessions: number };
  topPages: AnalyticsTableRow[];
  topEvents: AnalyticsTableRow[];
}

const HTTP_STATUS_SUFFIX = / \[\d{3}\]$/;

/** Firebase 13 appends " [NNN]" to callable messages; show only the server-authored text. */
export function normalizeCallableError(error: unknown): unknown {
  if (!(error instanceof Error) || !HTTP_STATUS_SUFFIX.test(error.message)) {
    return error;
  }
  const normalized = new Error(error.message.replace(HTTP_STATUS_SUFFIX, ""));
  normalized.name = error.name;
  const code = (error as Error & { code?: string }).code;
  if (code !== undefined) {
    (normalized as Error & { code?: string }).code = code;
  }
  return normalized;
}

@Injectable({
  providedIn: "root",
})
export class CloudFunctionsService {
  constructor(private firebase: FirebaseService) {}

  /** The in-app action handler's URL; callables validate it against an
   *  allowlist, and it is not configurable because src/environments is untracked. */
  appActionUrl(): string {
    return window.location.origin + "/auth/action";
  }

  private invoke<TInput, TOutput = unknown>(
    name: string,
    input: TInput,
  ): Promise<HttpsCallableResult<TOutput>> {
    const callable = httpsCallable<TInput, TOutput>(this.firebase.functions, name);
    return callable(input).catch(error => {
      throw normalizeCallableError(error);
    });
  }

  private call<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
    return this.invoke<TInput, TOutput>(name, input).then(result => result.data);
  }

  requestPasswordReset(email: string): Promise<unknown> {
    return this.invoke("requestPasswordReset", {
      email,
      continueUrl: this.appActionUrl(),
    });
  }

  submitRecoveryRequest(input: {
    email: string;
    name: string;
    alternateContact?: string;
    message?: string;
  }): Promise<unknown> {
    return this.invoke("submitRecoveryRequest", input);
  }

  createUserUpload(input: {
    eventName?: string;
    uploader: UploaderInfo;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    batchId?: string;
  }): Promise<CreatedUserUpload> {
    return this.call("createUserUpload", input);
  }

  adminGenerateResetLink(input: {
    requestId: string;
    email: string;
    reason: string;
    emailAlternateContact?: boolean;
  }): Promise<unknown> {
    return this.invoke("adminGenerateResetLink", {
      ...input,
      continueUrl: this.appActionUrl(),
    });
  }

  adminAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.call<Record<string, never>, AnalyticsSummary>("adminAnalyticsSummary", {});
  }

  updateAlertRecipients(emails: string[]): Promise<unknown> {
    return this.invoke("updateAlertRecipients", { emails });
  }

  closeRecoveryRequest(input: { requestId: string; reason?: string }): Promise<unknown> {
    return this.invoke("closeRecoveryRequest", input);
  }

  createMediaUpload(input: CreateMediaUploadRequest): Promise<CreateMediaUploadResponse> {
    return this.call("createMediaUpload", input);
  }

  resumeMediaUpload(input: ResumeMediaUploadRequest): Promise<ResumeMediaUploadResponse> {
    return this.call("resumeMediaUpload", input);
  }

  finalizeMediaUpload(input: FinalizeMediaUploadRequest): Promise<FinalizeMediaUploadResponse> {
    return this.call("finalizeMediaUpload", input);
  }

  updateMediaMetadata(input: UpdateMediaMetadataRequest): Promise<UpdateMediaMetadataResponse> {
    return this.call("updateMediaMetadata", input);
  }

  deleteMedia(input: DeleteMediaRequest): Promise<DeleteMediaResponse> {
    return this.call("deleteMedia", input);
  }
}
