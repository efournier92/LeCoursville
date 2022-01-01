import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  user: User;

  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService,
  ) {
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  ngOnInit() {
    this.logErrorsForAnalytics();
  }

  private logErrorsForAnalytics() {
    window.addEventListener('error', (err: ErrorEvent) => {
      this.analyticsService.logEvent('Error', {
        message: err?.message,
        lineInfo: err?.lineno,
        userAgent: window?.navigator?.userAgent,
        userId: this.user?.id,
        userName: this.user?.name,
      });
    });
  }
}
