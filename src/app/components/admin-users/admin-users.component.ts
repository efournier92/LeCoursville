import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { AdminService } from 'src/app/services/admin.service';
import { User } from 'src/app/models/user';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  user: User;
  allUsers: User[];

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
  ) { }

  ngOnInit(): void {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        if (this.user.roles && this.user.roles.super)
          this.getAllUsers();
      }
    )
  }

  getAllUsers(): void {
    this.adminService.allUsersObservable.subscribe(
      (allUsers: User[]) => {
        this.allUsers = allUsers;
        this.sortAllUsersBy(this.sortByDateAdded);
      }
    )
  }

  updateUser(user: User): void {
    user.isEditable = false;
    this.adminService.updateUser(user);
  }

  deleteUser(user: User): void {
    this.adminService.deleteUser(user);
  }

  sortAllUsersBy(sortFunction: any): void {
    if (this.allUsers.constructor === Array)
      this.allUsers = this.allUsers.sort(sortFunction);
  }

  sortByDateAdded(a: User, b: User): number {
    return new Date(b.dateRegistered).getTime() - new Date(a.dateRegistered).getTime();
  }

  addUserRole(user: User, roleType: string): void {
    user.roles[roleType] = true;
  }

  removeUserRole(user: User, roleType: string): void {
    delete user.roles[roleType];
  }
}
