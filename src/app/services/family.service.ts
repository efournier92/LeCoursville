import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Family } from 'src/app/models/family';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  private readonly FAMILIES_PATH = 'families';
  private familiesSource: BehaviorSubject<Family[]> = new BehaviorSubject([]);
  families$: Observable<Family[]> = this.familiesSource.asObservable();

  constructor(private rtdb: RtdbService) {
    this.getFamilies().valueChanges().subscribe((families: Family[]) => {
      this.familiesSource.next(families);
    });
  }

  getFamilies() {
    return this.rtdb.list<Family>(this.FAMILIES_PATH);
  }

  getFamily(id: string): Observable<Family | null> {
    return this.rtdb.object<Family>(this.FAMILIES_PATH + '/' + id).valueChanges();
  }

  createPushId(): string {
    return this.rtdb.createPushId();
  }

  saveFamily(family: Family): Promise<void> {
    return this.rtdb.object(this.FAMILIES_PATH + '/' + family.id).set(family);
  }

  updateFamily(id: string, data: Partial<Family>): Promise<void> {
    return this.rtdb.object(this.FAMILIES_PATH + '/' + id).update(data);
  }

  deleteFamily(id: string): Promise<void> {
    return this.rtdb.object(this.FAMILIES_PATH + '/' + id).remove();
  }
}
