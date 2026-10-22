import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { User } from 'src/app/models/user';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
    selector: 'app-user-edit',
    templateUrl: './user-edit.component.html',
    styleUrls: ['./user-edit.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UserEditComponent implements OnInit, OnChanges {
  @Input() userOnCard: User;
  @Input() isAdminMode = false;

  @Output() cancelEditClickedEvent = new EventEmitter();
  @Output() userSavedEvent = new EventEmitter<void>();

  userSignedIn: User;
  formUser: User;
  saveError = '';
  deleteError = '';
  private originalRoles = { admin: false, super: false };

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.snapshotRoles();
    this.resetForm();
    this.subscribeToUserObservable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // The card is recycled by track id, so a new user object must reset the
    // baseline or the next save confirms against the previous user's roles.
    if (changes.userOnCard) {
      this.snapshotRoles();
      this.resetForm();
    }
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => (this.userSignedIn = user),
    );
  }

  // PUBLIC METHODS

  updateUser(user: User): Promise<void> {
    return this.adminService.updateUser(user);
  }

  isSuperUser(): boolean {
    return this.userSignedIn?.roles?.super;
  }

  onSuperChange(user: User): void {
    // Server rules still gate admin writes on roles.admin, so super must carry admin.
    if (user.roles?.super) {
      user.roles.admin = true;
    }
  }

  onAdminChange(user: User): void {
    // Super implies admin; the checkbox is disabled but guard programmatic toggles too.
    if (user.roles?.super && !user.roles.admin) {
      user.roles.admin = true;
    }
  }

  async onSaveUser(user: User): Promise<void> {
    this.saveError = '';
    if (user.roles?.super) {
      user.roles.admin = true;
    }
    const changes = this.roleChanges(user);
    if (changes.messages.length > 0) {
      const confirmed = await this.confirmDialog.confirm({
        title: 'Change access?',
        message: changes.messages.join(' '),
        confirmLabel: 'Save',
        destructive: changes.destructive,
      });
      if (!confirmed) {
        this.resetForm();
        return;
      }
    }
    try {
      await this.updateUser(user);
      if (changes.messages.length > 0) {
        await this.recordRoleChange(user);
        this.originalRoles = {
          admin: user.roles?.admin === true,
          super: user.roles?.super === true,
        };
      }
    } catch (error) {
      this.saveError = `Could not save ${this.displayName(user)}: ${this.errorMessage(error)}`;
      return;
    }
    this.commitToInput(user);
    this.userSavedEvent.emit();
  }

  async onDeleteUser(user: User): Promise<void> {
    this.deleteError = '';
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete user?',
      message: `Delete ${this.displayName(user)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.adminService.deleteUser(user);
    } catch (error) {
      this.deleteError = `Could not delete ${this.displayName(user)}: ${this.errorMessage(error)}`;
      return;
    }
    if (this.isAdminMode) {
      this.emitCancelEditEvent();
    }
  }

  onCancelEdit(): void {
    this.saveError = '';
    this.deleteError = '';
    this.resetForm();
    this.emitCancelEditEvent();
  }

  // HELPER METHODS

  private resetForm(): void {
    this.formUser = this.userOnCard
      ? { ...this.userOnCard, roles: { ...this.userOnCard.roles } }
      : this.userOnCard;
  }

  private commitToInput(user: User): void {
    if (!this.userOnCard || this.userOnCard === user) {
      return;
    }
    this.userOnCard.name = user.name;
    this.userOnCard.email = user.email;
    this.userOnCard.roles = { ...user.roles };
  }

  private snapshotRoles(): void {
    this.originalRoles = {
      admin: this.userOnCard?.roles?.admin === true || this.userOnCard?.roles?.super === true,
      super: this.userOnCard?.roles?.super === true,
    };
  }

  private roleChanges(user: User): { messages: string[]; destructive: boolean } {
    const messages: string[] = [];
    let destructive = false;
    const name = this.displayName(user);
    const admin = user.roles?.admin === true;
    const superRole = user.roles?.super === true;

    if (admin !== this.originalRoles.admin) {
      messages.push(admin ? `Give ${name} admin access?` : `Remove admin access from ${name}?`);
      destructive = destructive || !admin;
    }
    if (superRole !== this.originalRoles.super) {
      messages.push(superRole ? `Give ${name} super access?` : `Remove super access from ${name}?`);
      destructive = destructive || !superRole;
    }

    return { messages, destructive };
  }

  private displayName(user: User): string {
    return user?.name?.trim() || user?.email || 'this user';
  }

  private recordRoleChange(user: User): Promise<void> {
    return this.adminService.addRoleAudit({
      actorId: this.userSignedIn?.id,
      targetId: user.id,
      targetEmail: user.email,
      before: { ...this.originalRoles },
      after: {
        admin: user.roles?.admin === true,
        super: user.roles?.super === true,
      },
      at: Date.now(),
    });
  }

  private errorMessage(error: unknown): string {
    return (error as Error)?.message || 'Unknown error';
  }

  private emitCancelEditEvent(): void {
    this.cancelEditClickedEvent.emit();
  }
}
