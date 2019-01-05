import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AdminService } from './admin.service';
import { User } from '../auth/user';
import { AngularFireAuth } from '@angular/fire/auth';

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
  ) { }

  ngOnInit() {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        if (this.user.roles && this.user.roles.super)
          this.getAllUsers();
      }
    )

  }

  getAllUsers() {
    this.adminService.allUsersObservable.subscribe(
      (allUsers: User[]) => {
        this.allUsers = allUsers;
      }
    )
  }

  deleteUser(user: User) {
    console.log(user);
    var test = this.fireAuth.admin;
  }



  // sortAllUsersBy(sortFunction) {
  //   this.allUsers = this.allUsers.sort(sortFunction);
  // }

  // sortByDateAdded(a: User, b: User) {
  //   return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
  // }
}
