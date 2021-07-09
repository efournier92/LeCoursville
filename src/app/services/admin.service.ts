import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  user: User;
  allUsers: AngularFireList<User>;

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

  getAllUsers(): AngularFireList<User> {
    this.allUsers = this.db.list('users');
    return this.allUsers;
  }

  private allUsersSource = new BehaviorSubject({});
  allUsersObservable = this.allUsersSource.asObservable();

  updateAllUsersEvent(users: User[]): void {
    this.allUsersSource.next(users);
  }

  updateUser(user: User): void {
    this.allUsers.update(user.id, user);
  }

  deleteUser(user: User): void {
    this.allUsers.remove(user.id);
  }
}
