import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DataRequest,
  DataRequestAuditEntry,
  DataRequestInput,
  DataRequestStatus,
  DataRequestVerificationMethod,
  REDACTED_CONTACT,
  buildDataRequest,
  validateDataRequest,
} from 'src/app/models/data-request';
import { RtdbService } from './rtdb.service';

const THROTTLE_LIMIT = 10;
const THROTTLE_WINDOW_MS = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class DataRequestsService {
  constructor(private rtdb: RtdbService) {}

  requests$(): Observable<DataRequest[]> {
    return this.rtdb.list<DataRequest>('dataRequests').valueChanges();
  }

  audit$(): Observable<DataRequestAuditEntry[]> {
    return this.rtdb.list<DataRequestAuditEntry>('dataRequestAudit').valueChanges();
  }

  async create(input: DataRequestInput, requesterUid?: string | null): Promise<string> {
    const errors = validateDataRequest(input);
    if (Object.keys(errors).length > 0) {
      throw new Error(Object.values(errors)[0]);
    }
    const id = this.rtdb.createPushId();
    const throttleKey = await this.throttleKey(input.contact.trim(), requesterUid);
    await this.bumpThrottle(throttleKey);
    const record = { ...buildDataRequest(id, input, Date.now(), requesterUid), throttleKey };
    await this.rtdb.object<DataRequest>(`dataRequests/${id}`).set(record);
    return id;
  }

  async setStatus(requestId: string, status: DataRequestStatus, actorUid: string): Promise<void> {
    await this.rtdb.object<DataRequest>(`dataRequests/${requestId}`).update({
      status,
      updatedAt: Date.now(),
      updatedBy: actorUid,
    });
  }

  /** Records the admin identity check that a removal grant requires. */
  async recordVerification(
    requestId: string,
    actorUid: string,
    method: DataRequestVerificationMethod = 'admin_review',
  ): Promise<void> {
    const now = Date.now();
    await this.rtdb.object<DataRequest>(`dataRequests/${requestId}`).update({
      verifiedAt: now,
      verifiedBy: actorUid,
      verificationMethod: method,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  /** A mistaken resolve or close can be reversed; grant and verification are cleared. */
  async reopen(requestId: string, actorUid: string): Promise<void> {
    const now = Date.now();
    await this.rtdb.object<DataRequest>(`dataRequests/${requestId}`).update({
      status: 'open',
      grantedAt: null,
      grantedBy: null,
      verifiedAt: null,
      verifiedBy: null,
      verificationMethod: null,
      redactedAt: null,
      redactedBy: null,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  /** Erases request PII after the request is no longer actionable and leaves the audit id intact. */
  async redact(requestId: string, actorUid: string): Promise<void> {
    const now = Date.now();
    await this.rtdb.object<DataRequest>(`dataRequests/${requestId}`).update({
      contact: REDACTED_CONTACT,
      description: '',
      redactedAt: now,
      redactedBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  /** Grant and audit are one atomic multi-path update so a failed audit cannot leave a silent grant. */
  async grantRemoval(request: DataRequest, actorUid: string): Promise<void> {
    const now = Date.now();
    const auditKey = this.rtdb.createPushId();
    await this.rtdb.updateRoot({
      [`dataRequests/${request.id}/status`]: 'resolved',
      [`dataRequests/${request.id}/grantedAt`]: now,
      [`dataRequests/${request.id}/grantedBy`]: actorUid,
      [`dataRequests/${request.id}/updatedAt`]: now,
      [`dataRequests/${request.id}/updatedBy`]: actorUid,
      [`dataRequestAudit/${auditKey}`]: {
        requestId: request.id,
        action: 'removal_granted',
        dataClass: request.dataClass,
        actorUid,
        createdAt: now,
      },
    });
  }

  private async throttleKey(contact: string, requesterUid?: string | null): Promise<string> {
    if (requesterUid) {
      return requesterUid;
    }
    const bytes = new TextEncoder().encode(contact.toLowerCase());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private async bumpThrottle(key: string): Promise<void> {
    const now = Date.now();
    const path = `dataRequestThrottle/${key}`;
    const current = await this.rtdb.get<{ count: number; windowStart: number }>(path);
    if (!current || now - current.windowStart > THROTTLE_WINDOW_MS) {
      await this.rtdb.object(path).set({ count: 1, windowStart: now });
      return;
    }
    if (current.count >= THROTTLE_LIMIT) {
      throw new Error('Too many requests from this contact. Try again later.');
    }
    await this.rtdb.object(path).set({ count: current.count + 1, windowStart: current.windowStart });
  }
}
