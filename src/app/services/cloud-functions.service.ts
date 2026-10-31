import { Injectable } from "@angular/core";
import { httpsCallable } from "firebase/functions";
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

  requestPasswordReset(email: string): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "requestPasswordReset")({
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
    return httpsCallable(this.firebase.functions, "submitRecoveryRequest")(input);
  }

  createUserUpload(input: {
    eventName?: string;
    uploader: UploaderInfo;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    batchId?: string;
  }): Promise<CreatedUserUpload> {
    const callable = httpsCallable<typeof input, CreatedUserUpload>(
      this.firebase.functions,
      "createUserUpload",
    );
    return callable(input).then(result => result.data);
  }

  adminGenerateResetLink(input: {
    requestId: string;
    email: string;
    reason: string;
    emailAlternateContact?: boolean;
  }): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "adminGenerateResetLink")({
      ...input,
      continueUrl: this.appActionUrl(),
    });
  }

  adminAnalyticsSummary(): Promise<AnalyticsSummary> {
    const callable = httpsCallable<Record<string, never>, AnalyticsSummary>(
      this.firebase.functions,
      "adminAnalyticsSummary",
    );
    return callable({}).then(result => result.data);
  }

  updateAlertRecipients(emails: string[]): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "updateAlertRecipients")({ emails });
  }

  closeRecoveryRequest(input: { requestId: string; reason?: string }): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "closeRecoveryRequest")(input);
  }

  createMediaUpload(input: CreateMediaUploadRequest): Promise<CreateMediaUploadResponse> {
    const callable = httpsCallable<CreateMediaUploadRequest, CreateMediaUploadResponse>(
      this.firebase.functions,
      "createMediaUpload",
    );
    return callable(input).then(result => result.data);
  }

  resumeMediaUpload(input: ResumeMediaUploadRequest): Promise<ResumeMediaUploadResponse> {
    const callable = httpsCallable<ResumeMediaUploadRequest, ResumeMediaUploadResponse>(
      this.firebase.functions,
      "resumeMediaUpload",
    );
    return callable(input).then(result => result.data);
  }

  finalizeMediaUpload(input: FinalizeMediaUploadRequest): Promise<FinalizeMediaUploadResponse> {
    const callable = httpsCallable<FinalizeMediaUploadRequest, FinalizeMediaUploadResponse>(
      this.firebase.functions,
      "finalizeMediaUpload",
    );
    return callable(input).then(result => result.data);
  }

  updateMediaMetadata(input: UpdateMediaMetadataRequest): Promise<UpdateMediaMetadataResponse> {
    const callable = httpsCallable<UpdateMediaMetadataRequest, UpdateMediaMetadataResponse>(
      this.firebase.functions,
      "updateMediaMetadata",
    );
    return callable(input).then(result => result.data);
  }

  deleteMedia(input: DeleteMediaRequest): Promise<DeleteMediaResponse> {
    const callable = httpsCallable<DeleteMediaRequest, DeleteMediaResponse>(
      this.firebase.functions,
      "deleteMedia",
    );
    return callable(input).then(result => result.data);
  }
}
