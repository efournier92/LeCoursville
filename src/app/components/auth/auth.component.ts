import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { RoutingService } from 'src/app/services/routing.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  user: User;

  constructor(
    private authService: AuthService,
    private routingService: RoutingService,
  ) { }

  ngOnInit(): void {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    );
  }

  onSignInSuccess(authData: any): boolean {
    const userData = authData?.authResult?.user;

    if (!userData) {
      this.authService.signOut();
      return false;
    }

    this.authService.createUser(userData);
    this.routingService.NavigateToRoute('/chat');
    
    return true;
  }

  onSignOutButtonClick(): void {
    const dialogRef = this.authService.openSignOutDialog();
    this.authService.onSignOutDialogClose(dialogRef);
  }
}
