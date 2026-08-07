import { Observable } from 'rxjs';
import { UploadTask } from 'firebase/storage';

/**
 * Minimal wrapper around the modular firebase/storage UploadTask that keeps the
 * AngularFire-era task API the UI components rely on (`percentageChanges()`,
 * `cancel()`).
 */
export class FireUploadTask {
  constructor(private task: UploadTask) {}

  percentageChanges(): Observable<number> {
    return new Observable<number>(subscriber => {
      const unsub = this.task.on('state_changed', {
        next: snap => {
          const pct = snap.totalBytes > 0 ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0;
          subscriber.next(Math.round(pct));
        },
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      });
      return () => unsub();
    });
  }

  cancel(): void {
    this.task.cancel();
  }

  /** Promise passthrough for callers that await task completion (AngularFire
   * tasks were thenable). */
  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<any> {
    return this.task.then(onfulfilled as any, onrejected as any);
  }
}
