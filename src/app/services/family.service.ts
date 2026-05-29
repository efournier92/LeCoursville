import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Family } from 'src/app/models/family';

@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  private readonly FAMILIES_PATH = 'families';
  private familiesSource: BehaviorSubject<Family[]> = new BehaviorSubject([]);
  families$: Observable<Family[]> = this.familiesSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getFamilies().valueChanges().subscribe((families: Family[]) => {
      this.familiesSource.next(families);
    });
  }

  getFamilies(): AngularFireList<Family> {
    return this.db.list(this.FAMILIES_PATH);
  }

  getFamily(id: string): Observable<Family | null> {
    return this.db.object(this.FAMILIES_PATH + '/' + id).valueChanges() as Observable<Family | null>;
  }

  createPushId(): string {
    return this.db.createPushId();
  }

  saveFamily(family: Family): Promise<void> {
    return this.db.object(this.FAMILIES_PATH + '/' + family.id).set(family);
  }

  updateFamily(id: string, data: Partial<Family>): Promise<void> {
    return this.db.object(this.FAMILIES_PATH + '/' + id).update(data);
  }

  deleteFamily(id: string): Promise<void> {
    return this.db.object(this.FAMILIES_PATH + '/' + id).remove();
  }
}