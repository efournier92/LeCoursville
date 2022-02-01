import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { AnalyticsService } from './services/analytics.service';
import { VersionService } from './services/version.service';

declare global {
  interface Window { version: any; }
}

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
    private versionService: VersionService,
  ) { }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  ngOnInit() {
    this.subscribeToUserObservable();
    this.writeVersionToWindow();
    this.listenForErrors();
  }

  // HELPERS

  private writeVersionToWindow() {
    window.version = this.versionService.getAppVersion();
  }

  private listenForErrors() {
    window.addEventListener('error', (err: ErrorEvent) => {
      this.analyticsService.logEvent('Error', {
        message: err?.message,
        value: err?.lineno,
        userAgent: window?.navigator?.userAgent,
        userId: this.user?.id,
      });
    });
  }
}
