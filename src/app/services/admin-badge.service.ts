import { Injectable } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RtdbService } from './rtdb.service';

interface StatusRow {
  status?: string;
}

/** Nav badge counts. Each call opens its listener on subscribe and closes it on unsubscribe. */
@Injectable({ providedIn: 'root' })
export class AdminBadgeService {
  constructor(private rtdb: RtdbService) {}

  pendingUploads(): Observable<number> {
    // userUploads is indexed on status in database.rules.json.
    return this.count('userUploads', 'pending');
  }

  outstandingRecoveryRequests(): Observable<number> {
    // RTDB has no "not equal" index; outstanding is the sum of the two live
    // statuses, keeping each query on the indexed `status` field.
    return combineLatest([
      this.count('recoveryRequests', 'open'),
      this.count('recoveryRequests', 'pending'),
    ]).pipe(map(([open, pending]) => open + pending));
  }

  private count(path: string, status: string): Observable<number> {
    return this.rtdb.list<StatusRow>(path, [
      this.rtdb.orderByChild('status'),
      this.rtdb.equalTo(status),
    ]).valueChanges().pipe(map(rows => rows.length));
  }
}
