import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { User } from './user';
import { AngularFireList, AngularFireDatabase, AngularFireObject } from '@angular/fire/database';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user: AngularFireObject<User>;
  constructor(private db: AngularFireDatabase, private auth: AngularFireAuth, private angularFireAuth: AngularFireAuth) {
    this.angularFireAuth.authState.subscribe(this.firebaseAuthChangeListener);
  }

  createUser(authData: any) {
    let user = new User(authData);
    this.db.object('users/' + user.id).set(user)
    // this.user = this.db.object(`users/${user.id}`);
    // this.user.set(user);
  }
  
  firebaseAuthChangeListener(authData) {
    // if needed, do a redirect in here
    if (authData) {
      // this.db.object('users/' + authData.uid)
      this.createUser(authData);
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


  updateUserContact(contact: User) {
    // this.contacts.update(contact.id, contact);
  }
}
