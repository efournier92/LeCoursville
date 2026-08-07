import { Injectable } from '@angular/core';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class PushIdFactory {

  constructor(
    private rtdb: RtdbService,
  ) { }

  create() {
    return this.rtdb.createPushId();
  }
}
