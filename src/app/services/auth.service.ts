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
  user: User;
  userObj: AngularFireObject<User>;
  private userSource = new BehaviorSubject({});
  userObservable = this.userSource.asObservable();

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
        this.userSource.next(user);
        this.user = user;
        this.setUser(authData, user);
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
    if (!user) { return; }
    this.userSource.next(user);
    this.db.object(`users/${user.id}`).update(user);
    this.setUserInLocalStorage(user);
  }

  setUser(authData: any, existingUser: User): void {
    if (!existingUser) {
      this.createUser(authData, existingUser);
    }
    this.updateUser(existingUser);
  }

  onSignIn(authData: any): void {
    const authUser = authData?.authResult?.user;

    if (!authUser?.uid) { return; }
    this.userObj = this.db.object(`users/${authUser?.uid}`);
    this.userObj.valueChanges().subscribe(
      (existingUser: User) => {
        if (!existingUser) {
          this.createUser(authData, existingUser);
          return;
        }
        const authUserObj = authData?.authResult?.user || authData;
        existingUser.dateLastSignedIn = authUserObj?.metadata?.lastSignInTime;
        this.updateUser(existingUser);
      }
    );
  }

  createUser(authData: any, existingUser: User): void {
    const user: User = new User(authData, existingUser);
    this.updateUser(user);
    this.setUserInLocalStorage(user);
  }

  signOut(): void {
    this.angularFireAuth.signOut().then(() => {
      this.userObj = undefined;
      this.removeUserFromLocalStorage();
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

  private getUserFromLocalStorage() {
    return JSON.parse(localStorage.getItem('user'));
  }

  private setUserInLocalStorage(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  private removeUserFromLocalStorage() {
    localStorage.removeItem('user');
  }

  isUserSignedIn(): boolean {
    const user = this.getUserFromLocalStorage();
    return !!user?.id;
  }

  isUserAdmin(): boolean {
    const user = this.getUserFromLocalStorage();
    return !!user?.roles?.admin;
  }
}
