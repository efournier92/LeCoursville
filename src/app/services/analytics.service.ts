import { Injectable } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/compat/analytics';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(
    private analytics: AngularFireAnalytics,
  ) { }

  logEvent(name: string, data: any) {
    this.analytics.logEvent(name, data);
  }
}
