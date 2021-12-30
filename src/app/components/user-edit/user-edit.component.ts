import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { User } from 'src/app/models/user';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.scss']
})
export class UserEditComponent implements OnInit {
  @Input() userToEdit: User;

  @Output() cancelEditClickedEvent = new EventEmitter();

  userSignedIn: User;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.ensureUserRulesExist();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.userSignedIn = user
    );
  }

  // PUBLIC METHODS

  updateUser(user: User): void {
    this.authService.updateUser(user);
  }

  addUserRole(user: User, roleType: string): void {
    if (!user.roles?.admin || !user.roles?.super) { 
      user.roles = { user: true, admin: false, super: false };
    }
    user.roles[roleType] = true;
  }

  isSuperUser(): boolean {
    return this.userSignedIn?.roles?.super;
  }

  onSaveUser(user: User): void {
    this.updateUser(user);
    this.emitCancelEditEvent();
  }

  onDeleteUser(user: User): void {
    this.deleteUser(this.userSignedIn);
  }

  onCancelEdit(): void {
    this.emitCancelEditEvent();
  }

  // HELPER METHODS

  private deleteUser(user: User): void {
    this.adminService.deleteUser(user);
  }

  private emitCancelEditEvent(): void {
    this.cancelEditClickedEvent.emit();
  }

  private ensureUserRulesExist(): void {
    if (!this.userToEdit.roles) {
      this.userToEdit.roles = { user: true, admin: false, super: false };
    } else if (!this.userToEdit.roles.admin) {
      this.userToEdit.roles = { user: this.userToEdit.roles.user, admin: false, super: false };
    } else if (!this.userToEdit.roles.super) {
      this.userToEdit.roles = { user: this.userToEdit.roles.user, admin: this.userToEdit.roles.super, super: false };
    }
  }
}
