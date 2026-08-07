import { Injectable } from '@angular/core';
import { logEvent } from 'firebase/analytics';
import { FirebaseService } from './firebase.service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(
    private firebase: FirebaseService,
  ) { }

  logEvent(name: string, data: any) {
    if (this.firebase.analytics) {
      logEvent(this.firebase.analytics, name, data);
    }
  }
}
