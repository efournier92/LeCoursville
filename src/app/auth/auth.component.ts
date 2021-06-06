import { Component, OnInit } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from './user';
import { AngularFireAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { ConfirmPromptService } from '../confirm-prompt/confirm-prompt.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  user: User;

  constructor(
    private auth: AuthService,
    private fireAuth: AngularFireAuth,
    private router: Router,
    private confirmPrompt: ConfirmPromptService,
  ) { }

  ngOnInit(): void {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    );
  }

  signInSuccess(): void {
    this.router.navigate(['/chat']);
  }

  signOut(): void {
    const dialogRef = this.confirmPrompt.openDialog(
      "Are You Sure?",
      "Do you want to sign out of LeCoursville?",
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          //this.fireAuth.auth.signOut();
          this.user = undefined;
        }
      }
    )
  }
}
