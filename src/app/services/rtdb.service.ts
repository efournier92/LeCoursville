import { Injectable } from '@angular/core';
import {
  Database,
  ref,
  onValue,
  set,
  update,
  remove,
  push,
  query as dbQuery,
  orderByChild,
  equalTo,
  limitToFirst,
  QueryConstraint,
} from 'firebase/database';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';

/**
 * Thin observable wrapper over the Firebase RTDB modular SDK that mirrors the
 * AngularFire `db.object(path).valueChanges()` / `db.list(path).valueChanges()`
 * API, so service rewrites stay mechanical. `valueChanges()` emits the current
 * snapshot on every change (including null for missing keys) and never
 * completes; unsubscribe to stop listening.
 */

export class RtdbObjectRef<T> {
  constructor(private db: Database, private path: string) {}

  valueChanges(): Observable<T | null> {
    return new Observable<T | null>(subscriber => {
      const dbRef = ref(this.db, this.path);
      const unsub = onValue(
        dbRef,
        snap => {
          const val = snap.val();
          subscriber.next(val === null || val === undefined ? null : (val as T));
        },
        err => subscriber.error(err),
      );
      return () => unsub();
    });
  }

  async update(value: object): Promise<void> {
    await update(ref(this.db, this.path), value as Record<string, unknown>);
  }

  async set(value: unknown): Promise<void> {
    await set(ref(this.db, this.path), value);
  }

  async remove(): Promise<void> {
    await remove(ref(this.db, this.path));
  }
}

export class RtdbListRef<T> {
  constructor(
    private db: Database,
    private path: string,
    private constraints: QueryConstraint[] = [],
  ) {}

  valueChanges(): Observable<T[]> {
    return new Observable<T[]>(subscriber => {
      const dbRef = this.buildRef();
      const unsub = onValue(
        dbRef,
        snap => {
          const val = snap.val();
          if (val === null || val === undefined) {
            subscriber.next([]);
            return;
          }
          if (typeof val === 'object') {
            subscriber.next(Object.values(val) as T[]);
            return;
          }
          subscriber.next([val] as T[]);
        },
        err => subscriber.error(err),
      );
      return () => unsub();
    });
  }

  /** AngularFire `list().snapshotChanges()` equivalent: key + value per child. */
  snapshotChanges<T>(): Observable<{ key: string; value: T }[]> {
    return new Observable<{ key: string; value: T }[]>(subscriber => {
      const dbRef = this.buildRef();
      const unsub = onValue(
        dbRef,
        snap => {
          const val = snap.val();
          if (val === null || val === undefined) {
            subscriber.next([]);
            return;
          }
          if (typeof val === 'object') {
            subscriber.next(
              Object.entries(val).map(([key, value]) => ({ key, value: value as T })),
            );
            return;
          }
          subscriber.next([{ key: snap.key, value: val as T }]);
        },
        err => subscriber.error(err),
      );
      return () => unsub();
    });
  }

  private buildRef(): any {
    let dbRef: any = ref(this.db, this.path);
    if (this.constraints.length > 0) {
      dbRef = dbQuery(dbRef, ...this.constraints);
    }
    return dbRef;
  }
}

@Injectable({ providedIn: 'root' })
export class RtdbService {
  constructor(private firebase: FirebaseService) {}

  object<T>(path: string): RtdbObjectRef<T> {
    return new RtdbObjectRef<T>(this.firebase.db, path);
  }

  list<T>(
    path: string,
    constraints: QueryConstraint[] = [],
  ): RtdbListRef<T> {
    return new RtdbListRef<T>(this.firebase.db, path, constraints);
  }

  /** Firebase push ID without writing anything (AngularFire `createPushId` equivalent). */
  createPushId(): string {
    return push(ref(this.firebase.db, 'pushIds')).key as string;
  }

  /** Create a new child with an auto-generated key (AngularFire `list().push` equivalent). */
  async push(path: string, value: unknown): Promise<string> {
    const childRef = push(ref(this.firebase.db, path), value);
    return childRef.key as string;
  }

  // Query constraint factories re-exported for callers that build list queries.
  orderByChild = orderByChild;
  equalTo = equalTo;
  limitToFirst = limitToFirst;
}
