import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AdminService } from './admin.service';
// import { User } from '../auth/user';
import { AngularFireAuth } from '@angular/fire/auth';
import * as firebase from 'firebase';
import { User } from '../auth/user';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  user: User;
  allUsers: User[];

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private fireAuth: AngularFireAuth,
    // private fireAdmin: Firebase,
  ) { }

  ngOnInit() {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        console.log('USER: ', user)
        if (this.user.roles && this.user.roles.super)
          this.getAllUsers();
      }
    )

  }

  getAllUsers() {
    this.adminService.allUsersObservable.subscribe(
      (allUsers: User[]) => {
        this.allUsers = allUsers;
        this.sortAllUsersBy(this.sortByDateAdded);
      }
    )
  }

  addUserRole(user: User, roleType: string) {
    user.roles[roleType] = true;
  }

  removeUserRole(user: User, roleType: string) {
    delete user.roles[roleType];
  }

  updateUser(user: User) {
    user.isEditable = false;
    this.adminService.updateUser(user);
  }

  deleteUser(user: User) {
    this.adminService.deleteUser(user);
  }

  sortAllUsersBy(sortFunction) {
    if (this.allUsers.constructor === Array)
      this.allUsers = this.allUsers.sort(sortFunction);
  }

  sortByDateAdded(a: User, b: User) {
    return new Date(b.dateRegistered).getTime() - new Date(a.dateRegistered).getTime();
  }
}
