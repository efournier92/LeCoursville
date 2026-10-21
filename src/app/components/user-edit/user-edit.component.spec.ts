import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { User } from 'src/app/models/user';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { UserEditComponent } from './user-edit.component';

const makeUser = (): User => ({
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  roles: { user: true, admin: false, super: false },
  dateRegistered: new Date(2024, 0, 1),
  dateLastActive: new Date(2024, 1, 1),
});

describe('UserEditComponent', () => {
  let component: UserEditComponent;
  let fixture: ComponentFixture<UserEditComponent>;
  let user$: BehaviorSubject<any>;
  let adminService: {
    updateUser: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
    addRoleAudit: ReturnType<typeof vi.fn>;
  };
  let confirmDialog: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    user$ = new BehaviorSubject<any>({ id: 'admin-1', roles: { user: true, admin: true, super: true } });
    adminService = {
      updateUser: vi.fn(() => Promise.resolve()),
      deleteUser: vi.fn(),
      addRoleAudit: vi.fn(() => Promise.resolve()),
    };
    confirmDialog = { confirm: vi.fn(() => Promise.resolve(false)) };

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        { provide: AuthService, useValue: { userObservable: user$.asObservable() } },
        { provide: AdminService, useValue: adminService },
        { provide: ConfirmDialogService, useValue: confirmDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEditComponent);
    component = fixture.componentInstance;
    component.userOnCard = makeUser();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deletes a user through the confirm dialog with the name and a destructive label', async () => {
    const user = makeUser();

    await component.onDeleteUser(user);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Delete Ada Lovelace? This cannot be undone.',
        destructive: true,
      }),
    );
    expect(adminService.deleteUser).not.toHaveBeenCalled();

    confirmDialog.confirm.mockResolvedValue(true);
    await component.onDeleteUser(user);

    expect(adminService.deleteUser).toHaveBeenCalledWith(user);
  });

  it('confirms a privilege change before saving and does nothing on cancel', async () => {
    const user = makeUser();
    component.userOnCard = user;
    component.ngOnInit();
    user.roles.admin = true;

    await component.onSaveUser(user);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Give Ada Lovelace admin access?',
        destructive: false,
      }),
    );
    expect(adminService.updateUser).not.toHaveBeenCalled();

    confirmDialog.confirm.mockResolvedValue(true);
    await component.onSaveUser(user);

    expect(adminService.updateUser).toHaveBeenCalledWith(user);
  });

  it('discards the working copy on cancel without touching the input user', () => {
    component.formUser.name = 'Changed Name';
    component.formUser.email = 'changed@example.test';
    component.formUser.roles.admin = true;

    component.onCancelEdit();

    expect(component.userOnCard.name).toBe('Ada Lovelace');
    expect(component.userOnCard.email).toBe('ada@example.test');
    expect(component.userOnCard.roles.admin).toBe(false);
    expect(component.formUser.name).toBe('Ada Lovelace');
    expect(component.formUser.email).toBe('ada@example.test');
    expect(component.formUser.roles.admin).toBe(false);
    expect(adminService.addRoleAudit).not.toHaveBeenCalled();
  });

  it('restores the working copy when a privilege confirm is declined', async () => {
    component.formUser.name = 'Changed Name';
    component.formUser.roles.admin = true;

    await component.onSaveUser(component.formUser);

    expect(confirmDialog.confirm).toHaveBeenCalled();
    expect(adminService.updateUser).not.toHaveBeenCalled();
    expect(component.userOnCard.name).toBe('Ada Lovelace');
    expect(component.userOnCard.roles.admin).toBe(false);
    expect(component.formUser.name).toBe('Ada Lovelace');
    expect(component.formUser.roles.admin).toBe(false);
    expect(adminService.addRoleAudit).not.toHaveBeenCalled();
  });

  it('writes one role-audit row after a successful role change', async () => {
    const user = makeUser();
    component.userOnCard = user;
    component.ngOnInit();
    confirmDialog.confirm.mockResolvedValue(true);
    user.roles.admin = true;

    await component.onSaveUser(user);

    expect(adminService.updateUser).toHaveBeenCalledWith(user);
    expect(adminService.addRoleAudit).toHaveBeenCalledTimes(1);
    expect(adminService.addRoleAudit).toHaveBeenCalledWith({
      actorId: 'admin-1',
      targetId: 'user-1',
      targetEmail: 'ada@example.test',
      before: { admin: false, super: false },
      after: { admin: true, super: false },
      at: expect.any(Number),
    });
  });

  it('records a super grant with admin implied in the audit row', async () => {
    const user = makeUser();
    component.userOnCard = user;
    component.ngOnInit();
    confirmDialog.confirm.mockResolvedValue(true);
    user.roles.super = true;

    await component.onSaveUser(user);

    expect(adminService.addRoleAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { admin: false, super: false },
        after: { admin: true, super: true },
      }),
    );
  });

  it('does not write an audit row when the user save fails', async () => {
    const user = makeUser();
    component.userOnCard = user;
    component.ngOnInit();
    confirmDialog.confirm.mockResolvedValue(true);
    adminService.updateUser.mockRejectedValueOnce(new Error('write failed'));
    user.roles.admin = true;

    await expect(component.onSaveUser(user)).rejects.toThrow('write failed');

    expect(adminService.addRoleAudit).not.toHaveBeenCalled();
  });

  it('commits the working copy to the input user on a confirmed save', async () => {
    confirmDialog.confirm.mockResolvedValue(true);
    component.formUser.name = 'Changed Name';
    component.formUser.roles.admin = true;

    await component.onSaveUser(component.formUser);

    expect(component.userOnCard.name).toBe('Changed Name');
    expect(component.userOnCard.roles.admin).toBe(true);
  });

  it('uses destructive styling when removing a role', async () => {
    const user = makeUser();
    user.roles = { user: true, admin: true, super: true };
    component.userOnCard = user;
    component.ngOnInit();
    user.roles.super = false;
    user.roles.admin = false;

    await component.onSaveUser(user);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Remove admin access from Ada Lovelace? Remove super access from Ada Lovelace?',
        destructive: true,
      }),
    );
  });

  it('saves silently when admin and super are unchanged', async () => {
    const user = makeUser();
    component.userOnCard = user;
    component.ngOnInit();

    await component.onSaveUser(user);

    expect(confirmDialog.confirm).not.toHaveBeenCalled();
    expect(adminService.updateUser).toHaveBeenCalledWith(user);
    expect(adminService.addRoleAudit).not.toHaveBeenCalled();
  });

  it('resets the role baseline when the card is reused for a new user', async () => {
    const replacement = makeUser();
    replacement.roles.admin = true;

    fixture.componentRef.setInput('userOnCard', replacement);
    fixture.detectChanges();

    await component.onSaveUser(replacement);

    expect(confirmDialog.confirm).not.toHaveBeenCalled();
    expect(adminService.updateUser).toHaveBeenCalledWith(replacement);
  });

  it('keeps admin checked whenever super is enabled', () => {
    const user = makeUser();
    user.roles.super = true;

    component.onSuperChange(user);
    expect(user.roles.admin).toBe(true);

    user.roles.admin = false;
    component.onAdminChange(user);
    expect(user.roles.admin).toBe(true);
  });

  it('has no localStorage-backed role fallback', () => {
    expect((component as any).shouldSeeRoles).toBeUndefined();
  });
});
