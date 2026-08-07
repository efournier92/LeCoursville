import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  user: User;

  private allUsersSource = new BehaviorSubject({ });
  allUsersObservable = this.allUsersSource.asObservable();

  constructor(
    private rtdb: RtdbService,
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
    );
  }

  getAllUsers() {
    return this.rtdb.list<User>('users');
  }

  updateAllUsersEvent(users: User[]): void {
    this.allUsersSource.next(users);
  }

  updateUser(user: User): void {
    this.rtdb.object(`users/${user.id}`).update(user as any);
  }

  deleteUser(user: User): void {
    this.rtdb.object(`/users/${user.id}`).remove();
  }
}
