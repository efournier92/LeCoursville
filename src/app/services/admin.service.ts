import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
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
export class AdminService implements OnDestroy {
  user: User;

  private allUsersSource = new BehaviorSubject({ });
  allUsersObservable = this.allUsersSource.asObservable();

  private userSub: Subscription;
  private usersSub: Subscription;
  private listenersForUserId: string | null = null;

  constructor(
    private rtdb: RtdbService,
    private auth: AuthService,
  ) {
    this.userSub = this.auth.userObservable.subscribe(
      (user: User) => {
        if (!user?.id) {
          return;
        }
        this.user = user;
        // userObservable re-emits on every profile write; one RTDB listener per
        // signed-in user is enough, and it must follow a different sign-in.
        if (user.id === this.listenersForUserId) {
          return;
        }
        this.listenersForUserId = user.id;
        this.usersSub?.unsubscribe();
        this.usersSub = this.getAllUsers().valueChanges().subscribe(
          (users: User[]) => {
            this.updateAllUsersEvent(users);
          }
        );
      }
    );
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.usersSub?.unsubscribe();
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
