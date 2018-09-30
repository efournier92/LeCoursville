import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { User } from './user';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  userObj: AngularFireObject<User>;
  user: User;
  private userSource = new BehaviorSubject({});
  userObservable = this.userSource.asObservable();

  constructor(
    private db: AngularFireDatabase,
    private angularFireAuth: AngularFireAuth,
  ) {
    this.angularFireAuth.authState.subscribe(
      authData => this.getUser(authData)
    )
  }

  getUser(authData: any): AngularFireObject<User> {
    if (!authData || !authData.uid) return;
    this.userObj = this.db.object(`users/${authData.uid}`);
    this.userObj.valueChanges().subscribe(
      (user: User) => {
        this.setUser(user, authData);
      }
    )
  }

  updatedUser(user: any) {
    this.userSource.next(user);
  }

  setUser(user: User, authData: any) {
    if (!user) {
      this.createUser(authData);
    } else {
      this.user = user;
    }
    this.updatedUser(this.user)
  }

  createUser(authData: any) {
    let user = new User(authData);
    this.userObj.set(user);
    this.user = user;
  }
}
