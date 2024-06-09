import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { User } from 'src/app/models/user';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { PromptModalService } from 'src/app/services/prompt-modal.service';

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.scss'],
})
export class UserEditComponent implements OnInit {
  @Input() userOnCard: User;
  @Input() isAdminMode = false;

  @Output() cancelEditClickedEvent = new EventEmitter();

  userSignedIn: User;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private promptModal: PromptModalService,
  ) {}

  ngOnInit(): void {
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => (this.userSignedIn = user),
    );
  }

  // PUBLIC METHODS

  updateUser(user: User): void {
    this.adminService.updateUser(user);
  }

  isSuperUser(): boolean {
    return this.userSignedIn?.roles?.super;
  }

  onSaveUser(user: User): void {
    this.updateUser(user);
    if (this.isAdminMode) {
      this.emitCancelEditEvent();
    }
  }

  onDeleteUser(user: User): void {
    this.deleteUser(user);
  }

  onCancelEdit(): void {
    this.emitCancelEditEvent();
  }

  shouldSeeRoles(): boolean {
    return this.authService.isUserAdmin();
  }

  // HELPER METHODS

  private deleteUser(user: User): void {
    const dialogRef = this.promptModal.openDialog(
      'Are You Sure?',
      'Do you really want to delete this user?',
    );
    dialogRef.afterClosed().subscribe((didUserConfirm: boolean) => {
      if (didUserConfirm) {
        this.adminService.deleteUser(user);
      }
    });
  }

  private emitCancelEditEvent(): void {
    this.cancelEditClickedEvent.emit();
  }
}
