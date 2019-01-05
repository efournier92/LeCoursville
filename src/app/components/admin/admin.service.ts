import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { User } from '../auth/user';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  user: User;
  allUsers: AngularFireList<User>;

  private allUsersSource = new BehaviorSubject({});
  allUsersObservable = this.allUsersSource.asObservable();

  constructor(
    private db: AngularFireDatabase,
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        this.getAllUsers().valueChanges().subscribe(
          (users: User[]) => {
            this.updateAllUsersEvent(users);
          }
        );
      }
    )
  }

  updateAllUsersEvent(users: User[]): void {
    this.allUsersSource.next(users);
  }

  getAllUsers(): AngularFireList<User> {
    // if (!this.user || !this.user.roles || !this.user.roles.super) return;
    this.allUsers = this.db.list('users');
    return this.allUsers;
  }

  deleteUser(user: User): void {
    console.log(user);
    // this.allUsers.remove(user.id);
    // this.storage.storage.refFromURL(photo.url).delete();
  }

}
