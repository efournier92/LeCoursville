import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DataRequest,
  DataRequestAuditEntry,
  DataRequestInput,
  DataRequestStatus,
  buildDataRequest,
  validateDataRequest,
} from 'src/app/models/data-request';
import { RtdbService } from './rtdb.service';

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
    const record = buildDataRequest(id, input, Date.now(), requesterUid);
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

  /** Granting is a decision record; the pre-delete export and hard delete stay manual. */
  async grantRemoval(requestId: string, actorUid: string): Promise<void> {
    const now = Date.now();
    await this.rtdb.object<DataRequest>(`dataRequests/${requestId}`).update({
      status: 'resolved',
      grantedAt: now,
      grantedBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });
    await this.rtdb.push('dataRequestAudit', {
      requestId,
      action: 'removal_granted',
      actorUid,
      createdAt: now,
    });
  }
}
