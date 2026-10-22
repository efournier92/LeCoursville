import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { RtdbService } from './rtdb.service';

export interface RoleAuditRecord {
  actorId: string;
  targetId: string;
  targetEmail: string;
  before: { admin: boolean; super: boolean };
  after: { admin: boolean; super: boolean };
  at: number;
}

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

  updateUser(user: User): Promise<void> {
    return this.rtdb.object(`users/${user.id}`).update(user as any);
  }

  addRoleAudit(record: RoleAuditRecord): Promise<void> {
    const id = this.rtdb.createPushId();
    return this.rtdb.object(`roleAudit/${id}`).set(record);
  }

  deleteUser(user: User): Promise<void> {
    return this.rtdb.object(`/users/${user.id}`).remove();
  }
}
