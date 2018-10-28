import { Component, OnInit } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from './user';
import { AngularFireAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';

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
  ) { }

  ngOnInit(): void {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    );
  }

  signInSuccess(): void {
    this.router.navigate(['/chat'])
  }

  signOut() {
    this.fireAuth.auth.signOut();
    this.user = undefined;
  }

}
