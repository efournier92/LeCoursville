import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/database';

@Injectable({
  providedIn: 'root'
})
export class PushIdService {

  constructor(
    private db: AngularFireDatabase,
  ) { }

  create() {
    return this.db.createPushId();
  }
}
