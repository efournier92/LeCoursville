import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/database';
import { MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { User } from 'src/app/models/user';
import { RoutingService } from 'src/app/services/routing.service';
import { ConfirmPromptComponent } from 'src/app/components/confirm-prompt/confirm-prompt.component';
import { ConfirmPromptService } from 'src/app/services/confirm-prompt.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSource = new BehaviorSubject({ });
  userObservable = this.userSource.asObservable();
  userObj: AngularFireObject<User>;

  constructor(
    private db: AngularFireDatabase,
    private angularFireAuth: AngularFireAuth,
    private routingService: RoutingService,
    private confirmPrompt: ConfirmPromptService
  ) {
    this.angularFireAuth.authState.subscribe(
      authData => this.getUser(authData)
    );
  }

  getUser(authData: any): void {
    if (!authData || !authData.uid) { return; }

    this.userObj = this.db.object(`users/${authData.uid}`);
    this.userObj.valueChanges().subscribe(
      (user: User) => {
        this.setUser(user, authData);
      }
    );
  }

  getUserNameById(userId: string): string {
    const userObj = this.db.object(`users/${userId}`);
    let user: User;

    userObj.valueChanges().subscribe(
      (updatedUser: User) => {
        user = updatedUser;
      }
    );

    return user.name;
  }

  updateUser(user: User): void {
    this.userSource.next(user);
    this.db.object(`users/${user.id}`).update(user);
  }

  setUser(user: User, authData: any): void {
    if (!user) {
      this.createUser(authData);
    }
    this.updateUser(user);
  }

  createUser(authData: any): void {
    const user: User = new User(authData);
    this.updateUser(user);
  }

  signOut(): void {
    this.angularFireAuth.signOut().then(() => {
      this.userObj = undefined;
      this.routingService.RefreshCurrentRoute();
    });
  }

  openSignOutDialog(): MatDialogRef<ConfirmPromptComponent, any> {
    return this.confirmPrompt.openDialog(
      'Are You Sure?',
      'Do you want to sign out of LeCoursville?',
    );
  }

  onSignOutDialogClose(dialogRef: MatDialogRef<ConfirmPromptComponent, any>): void {
    dialogRef.afterClosed().subscribe(
      (signOutConfirmed: boolean) => {
        if (signOutConfirmed) {
          this.signOut();
        }
      }
    );
  }
}
