import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Clan } from 'src/app/models/clan';

@Injectable({
  providedIn: 'root'
})
export class ClanService {
  private readonly CLANS_PATH = 'clans';
  private clansSource: BehaviorSubject<Clan[]> = new BehaviorSubject([]);
  clans$: Observable<Clan[]> = this.clansSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getClans().valueChanges().subscribe((clans: Clan[]) => {
      this.clansSource.next(clans);
    });
  }

  getClans(): AngularFireList<Clan> {
    return this.db.list(this.CLANS_PATH);
  }

  getClan(id: string): Observable<Clan | null> {
    return this.db.object(this.CLANS_PATH + '/' + id).valueChanges() as Observable<Clan | null>;
  }

  createPushId(): string {
    return this.db.createPushId();
  }

  saveClan(clan: Clan): Promise<void> {
    return this.db.object(this.CLANS_PATH + '/' + clan.id).set(clan);
  }

  updateClan(id: string, data: Partial<Clan>): Promise<void> {
    return this.db.object(this.CLANS_PATH + '/' + id).update(data);
  }

  deleteClan(id: string): Promise<void> {
    return this.db.object(this.CLANS_PATH + '/' + id).remove();
  }
}