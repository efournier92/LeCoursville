import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { RoutingService } from 'src/app/services/routing.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  user: User;
  isEditing: boolean;

  constructor(
    private authService: AuthService,
    private routingService: RoutingService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    // Remove any extraneous URL information
    this.routingService.NavigateToSignIn();
    this.isEditing = false;
    this.subscribeToUserObservable();
    this.analyticsService.logEvent('component_load_auth', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  onSignInSuccess(authData: any): boolean {
    const userData = authData?.authResult?.user;

    this.analyticsService.logEvent('auth_sign_in',
      { userId: userData?.uid }
    );

    if (!userData) {
      this.authService.signOut();
      return false;
    }

    this.authService.onSignIn(authData);
    this.routingService.NavigateToAudio();

    return true;
  }

  onSignOutButtonClick(): void {
    this.analyticsService.logEvent('auth_sign_out',
      { userId: this.user?.id }
    );
    const dialogRef = this.authService.openSignOutDialog();
    this.authService.onSignOutDialogClose(dialogRef);
  }

  onEdit(): void {
    this.isEditing = true;
  }

  onCancelEdit(): void {
    this.isEditing = false;
  }
}
