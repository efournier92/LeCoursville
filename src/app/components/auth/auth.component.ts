import { Component, OnInit } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from './user';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  user: User;

  constructor(private auth: AuthService) { }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        console.log('authLog', this.user);
      }
    );
  }

}
