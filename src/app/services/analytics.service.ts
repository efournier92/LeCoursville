import { Injectable } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { Media } from 'src/app/models/media';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  user: User;

  constructor(
    private analytics: AngularFireAnalytics,
    private authService: AuthService,
  ) { 
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  private logEvent(name: string, data: any) {
    this.analytics.logEvent(name, data);
  }

  logPageView(pageName: string) {
    const data = {
      'page': pageName,
    }
    this.logEvent("page_view", data);
  }

  logMediaSelect(media: Media) {
    const data = {
      'id': media.id,
      'name': media.name,
      'user_id': this.user.id,
    };

    this.logEvent("media_selection", data);
  }
}
