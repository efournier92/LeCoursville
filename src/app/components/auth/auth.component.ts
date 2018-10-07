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

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    );
  }

  signInSuccess($event) {
    this.router.navigate(['/calendar'])
  }

  signOut() {
    this.fireAuth.auth.signOut();
    this.user = undefined;
  }

}
