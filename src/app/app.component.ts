import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AuthService } from './components/auth/auth.service';
import { User } from 'firebase';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  user: User;

  constructor(private auth: AuthService) {
  }

  ngOnInit() {
   
  }

  successCallback($event) {
    console.log('callback', $event);
  }

}

