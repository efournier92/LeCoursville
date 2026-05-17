import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Anniversary } from 'src/app/models/anniversary';

@Injectable({
  providedIn: 'root'
})
export class AnniversariesService {
  private anniversariesSource: BehaviorSubject<Anniversary[]> = new BehaviorSubject([]);
  anniversaries$: Observable<Anniversary[]> = this.anniversariesSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getAnniversaries().valueChanges().subscribe(
      (anniversaries: Anniversary[]) => {
        this.anniversariesSource.next(anniversaries);
      }
    );
  }

  getAnniversaries(): AngularFireList<Anniversary> {
    return this.db.list('anniversaries');
  }

  getAnniversary(id: string): Observable<Anniversary | null> {
    return this.db.object('anniversaries/' + id).valueChanges() as Observable<Anniversary | null>;
  }

  saveAnniversary(anniversary: Anniversary): void {
    if (!anniversary.id) {
      anniversary.id = this.db.createPushId();
    }
    this.db.object('anniversaries/' + anniversary.id).set(anniversary);
  }

  updateAnniversary(id: string, data: Partial<Anniversary>): void {
    this.db.object('anniversaries/' + id).update(data);
  }
}