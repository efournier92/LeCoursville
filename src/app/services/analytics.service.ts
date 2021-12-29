import { Injectable } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { Media } from 'src/app/models/media/media';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private user: User;

  constructor(
    private analytics: AngularFireAnalytics,
    private authService: AuthService,
  ) {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    );
  }

  logEvent(name: string, data: any) {
    this.analytics.logEvent(name, data);
  }
}
