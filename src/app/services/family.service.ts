import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Family } from 'src/app/models/family';
import { RtdbService } from './rtdb.service';

export type FamiliesStatus = 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  private readonly FAMILIES_PATH = 'families';
  private familiesSource: BehaviorSubject<Family[]> = new BehaviorSubject([]);
  families$: Observable<Family[]> = this.familiesSource.asObservable();
  private familiesStatusSource: BehaviorSubject<FamiliesStatus> = new BehaviorSubject<FamiliesStatus>('loading');
  familiesStatus$: Observable<FamiliesStatus> = this.familiesStatusSource.asObservable();
  private familiesSnapshot: Family[] = [];

  constructor(private rtdb: RtdbService) {
    this.getFamilies().valueChanges().subscribe({
      next: (families: Family[]) => {
        this.familiesSource.next(families);
        this.familiesSnapshot = families || [];
        this.familiesStatusSource.next('ready');
      },
      error: () => this.familiesStatusSource.next('error'),
    });
  }

  getFamiliesSnapshot(): Family[] {
    return this.familiesSnapshot;
  }

  resolveFamilyIdByName(name: string): string | undefined {
    const key = name.trim().toLowerCase();
    return this.familiesSnapshot.find(family => family.name.toLowerCase() === key)?.id;
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
