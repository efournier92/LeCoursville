import { Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  user: User;

  constructor(
    private auth: AuthService,
    private analyticsService: AnalyticsService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  ngOnInit() {
    // this.analyticsService.init();
  
    // this.router.events.subscribe(event => {
    //   if (event instanceof NavigationEnd) {
    //     (window as any).ga('set', 'page', event.urlAfterRedirects);
    //     (window as any).ga('send', 'pageview');
    //   }
    // });
  }
}
