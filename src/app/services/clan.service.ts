import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Clan } from 'src/app/models/clan';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class ClanService {
  private readonly CLANS_PATH = 'clans';
  private clansSource: BehaviorSubject<Clan[]> = new BehaviorSubject([]);
  clans$: Observable<Clan[]> = this.clansSource.asObservable();

  constructor(private rtdb: RtdbService) {
    this.getClans().valueChanges().subscribe((clans: Clan[]) => {
      this.clansSource.next(clans);
    });
  }

  getClans() {
    return this.rtdb.list<Clan>(this.CLANS_PATH);
  }

  getClan(id: string): Observable<Clan | null> {
    return this.rtdb.object<Clan>(this.CLANS_PATH + '/' + id).valueChanges();
  }

  createPushId(): string {
    return this.rtdb.createPushId();
  }

  saveClan(clan: Clan): Promise<void> {
    return this.rtdb.object(this.CLANS_PATH + '/' + clan.id).set(clan);
  }

  updateClan(id: string, data: Partial<Clan>): Promise<void> {
    return this.rtdb.object(this.CLANS_PATH + '/' + id).update(data);
  }

  deleteClan(id: string): Promise<void> {
    return this.rtdb.object(this.CLANS_PATH + '/' + id).remove();
  }
}
