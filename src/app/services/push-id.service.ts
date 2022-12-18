import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Injectable({
  providedIn: 'root'
})
export class PushIdFactory {

  constructor(
    private db: AngularFireDatabase,
  ) { }

  create() {
    return this.db.createPushId();
  }
}
