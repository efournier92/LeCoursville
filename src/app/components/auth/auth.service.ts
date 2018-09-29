import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { User } from './user';
import { AngularFireList, AngularFireDatabase, AngularFireObject } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  userObj: AngularFireObject<User>;
  user: User;
  authData: any;

  constructor(
    private db: AngularFireDatabase,
    private angularFireAuth: AngularFireAuth,
  ) {
    this.angularFireAuth.authState.subscribe(
      authData => {
        let newUser = new User(authData);
        this.userObj = this.db.object(`users/${newUser.id}`);
        this.userObj.valueChanges().subscribe(
          user => {
            if (!user) {
              this.userObj.set(newUser);
              this.user = newUser;
            } else {
              this.user = user;
            }
            this.updatedDataSelection(this.user)
          }
        )
      }
    )
  }

  private userSource = new BehaviorSubject({});
  userObservable = this.userSource.asObservable();

  updatedDataSelection(user: any){
    this.userSource.next(user);
  }

  // private authDataSource = new BehaviorSubject<AngularFireObject<User>>(this.user);
  // public authDataObeservable = this.authDataSource.asObservable();
  // updateAuthDataEvent(authData: any) {
  //   let user = new User(authData);
  //   this.authDataSource.next(user);
  // }

  firebaseAuthChangeListener(authData) {
    // if needed, do a redirect in here
    if (authData) {
      this.authData = authData;
      // this.createUser(authData);
      // this.db.object('users/' + authData.uid)
      // this.createUser(authData);
      console.log('Logged in :)');
    } else {
      console.log('Logged out :(');
    }
  }

  getUser(uid: string): AngularFireObject<User> {
    // if (!userId) return;
    // if (!this.user) this.createUserContact;
    return this.user;
  }

  createUser(authData: any) {
    let user = new User(authData);
    this.db.object('users/' + user.id).set(user)
    // this.user = this.db.object(`users/${user.id}`);
    // this.user.set(user);
  }

  updateUserContact(contact: User) {
    // this.contacts.update(contact.id, contact);
  }
}
