import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DataRequest,
  DataRequestInput,
  DataRequestStatus,
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
