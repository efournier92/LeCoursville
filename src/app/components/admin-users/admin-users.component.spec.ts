import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { RtdbService } from 'src/app/services/rtdb.service';
import { User } from 'src/app/models/user';
import { UserEditComponent } from 'src/app/components/user-edit/user-edit.component';
import { AdminUsersComponent } from './admin-users.component';

const makeUser = (id: number, name: string): User => ({
  id: `user-${id}`,
  name,
  email: `user${id}@example.com`,
  roles: { user: true, admin: false, super: false },
  dateRegistered: new Date(2024, 0, id),
  dateLastActive: new Date(2024, 1, id),
});

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;
  let usersSource: BehaviorSubject<unknown>;
  let adminService: {
    allUsersObservable: unknown;
    deleteUser: ReturnType<typeof vi.fn>;
  };
  let confirmDialog: { confirm: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let dialogRef: {
    componentRef: { setInput: ReturnType<typeof vi.fn> };
    componentInstance: {
      userSavedEvent: EventEmitter<void>;
      cancelEditClickedEvent: EventEmitter<void>;
    };
    close: ReturnType<typeof vi.fn>;
    afterClosed: () => Subject<unknown>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let queryParams: Record<string, string>;
  let roleAuditSource: BehaviorSubject<unknown>;
  let pendingUploadsSource: BehaviorSubject<unknown>;
  let rtdb: {
    list: ReturnType<typeof vi.fn>;
    orderByChild: ReturnType<typeof vi.fn>;
    equalTo: ReturnType<typeof vi.fn>;
  };

  const users = [
    makeUser(1, 'Ada Lovelace'),
    makeUser(2, 'Grace Hopper'),
    makeUser(3, 'Alan Turing'),
  ];

  beforeEach(async () => {
    usersSource = new BehaviorSubject<unknown>({});
    roleAuditSource = new BehaviorSubject<unknown>([]);
    pendingUploadsSource = new BehaviorSubject<unknown>([]);
    queryParams = {};
    adminService = {
      allUsersObservable: usersSource.asObservable(),
      deleteUser: vi.fn(() => Promise.resolve()),
    };
    confirmDialog = { confirm: vi.fn(() => Promise.resolve(false)) };
    dialogRef = {
      componentRef: { setInput: vi.fn() },
      componentInstance: {
        userSavedEvent: new EventEmitter<void>(),
        cancelEditClickedEvent: new EventEmitter<void>(),
      },
      close: vi.fn(),
      afterClosed: () => new Subject<unknown>(),
    };
    dialog = { open: vi.fn(() => dialogRef) };
    router = { navigate: vi.fn() };
    rtdb = {
      list: vi.fn((path: string) => ({
        valueChanges: () => path === 'roleAudit'
          ? roleAuditSource.asObservable()
          : pendingUploadsSource.asObservable(),
      })),
      orderByChild: vi.fn((key: string) => ({ key })),
      equalTo: vi.fn((value: string) => ({ value })),
    };

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        { provide: AdminService, useValue: adminService },
        {
          provide: AuthService,
          useValue: { userObservable: of({}), isUserAdmin: () => true },
        },
        { provide: ConfirmDialogService, useValue: confirmDialog },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: router },
        { provide: RtdbService, useValue: rtdb },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (key: string) => queryParams[key] ?? null } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
  });

  const settle = (nextUsers: unknown) => {
    usersSource.next(nextUsers);
    fixture.detectChanges();
  };

  it('shows a skeleton until the user list resolves, then the table', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.admin-skeleton-rows')).toBeTruthy();

    settle(users);

    expect(fixture.nativeElement.querySelector('.admin-skeleton-rows')).toBeFalsy();
    expect(fixture.nativeElement.querySelectorAll('.admin-table tbody tr')).toHaveLength(3);
    expect(component.showingRange).toBe('Showing 1-3 of 3');
  });

  it('renders the contract columns and compact role badges', () => {
    fixture.detectChanges();
    settle(users);

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-table thead th'),
    ).map((cell: Element) => cell.textContent?.trim());
    expect(headers).toEqual(['Name', 'Email', 'Last Active', 'Registered', 'Roles', '']);

    const admin = { ...users[0], roles: { user: true, admin: true, super: true } };
    expect(component.userRoles(admin)).toEqual(['Admin', 'Super', 'Member']);
  });

  it('renders the empty state when there are no users', () => {
    fixture.detectChanges();
    settle([]);

    expect(component.state).toBe('ready');
    expect(fixture.nativeElement.querySelector('app-no-results-message')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.admin-table tbody tr')).toHaveLength(0);
  });

  it('resets to page 1 when the filter changes and paginates 10 at a time', () => {
    const many = Array.from({ length: 12 }, (_, i) => makeUser(i + 1, `Person ${i + 1}`));
    fixture.detectChanges();
    settle(many);

    expect(component.pageIndex).toBe(1);
    expect(component.filteredTotal).toBe(12);
    expect(component.displayedUsers).toHaveLength(10);

    component.nextPage();
    fixture.detectChanges();
    expect(component.pageIndex).toBe(2);
    expect(component.displayedUsers).toHaveLength(2);

    component.onFilterQueryChange('Person 2');
    fixture.detectChanges();
    expect(component.pageIndex).toBe(1);
    expect(component.filteredTotal).toBe(1);
    expect(component.displayedUsers[0].name).toBe('Person 2');
  });

  it('restores search, sort, and page from query params', () => {
    queryParams = { q: 'Person', sort: 'name', dir: 'ASC', page: '2' };
    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    const many = Array.from({ length: 12 }, (_, i) => makeUser(i + 1, `Person ${i + 1}`));

    usersSource.next(many);
    fixture.detectChanges();

    expect(component.sortSettings.activeFilterQuery).toBe('Person');
    expect(component.sortSettings.activeSortProperty.key).toBe('name');
    expect(component.isSortDescending()).toBe(false);
    expect(component.pageIndex).toBe(2);
  });

  it('persists search, sort, and page changes to query params', () => {
    const many = Array.from({ length: 12 }, (_, i) => makeUser(i + 1, `Person ${i + 1}`));
    fixture.detectChanges();
    settle(many);

    component.onFilterQueryChange('Person');
    expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ q: 'Person', page: null }),
    }));

    component.sortByName();
    expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ sort: 'name', dir: null }),
    }));

    component.nextPage();
    expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ page: 2 }),
    }));
  });

  it('opens the editor dialog with the row user and closes on save or cancel', () => {
    fixture.detectChanges();
    settle(users);

    component.openEditor(users[0]);

    expect(dialog.open).toHaveBeenCalledWith(
      UserEditComponent,
      expect.objectContaining({ width: '520px' }),
    );
    expect(dialogRef.componentRef.setInput).toHaveBeenCalledWith('userOnCard', users[0]);
    expect(dialogRef.componentRef.setInput).toHaveBeenCalledWith('isAdminMode', true);

    dialogRef.componentInstance.userSavedEvent.emit();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);

    dialogRef.componentInstance.cancelEditClickedEvent.emit();
    expect(dialogRef.close).toHaveBeenCalledTimes(2);
  });

  it('cancels a row delete without touching the user', async () => {
    fixture.detectChanges();
    settle(users);

    await component.deleteUser(users[0]);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Delete Ada Lovelace? This cannot be undone. 0 pending uploads reference this member.',
      destructive: true,
    }));
    expect(adminService.deleteUser).not.toHaveBeenCalled();
  });

  it('deletes a confirmed row and surfaces a rejected delete', async () => {
    fixture.detectChanges();
    settle(users);

    confirmDialog.confirm.mockResolvedValueOnce(true);
    await component.deleteUser(users[0]);
    expect(adminService.deleteUser).toHaveBeenCalledWith(users[0]);

    adminService.deleteUser.mockRejectedValueOnce(new Error('permission denied'));
    confirmDialog.confirm.mockResolvedValueOnce(true);
    await component.deleteUser(users[1]);
    fixture.detectChanges();

    expect(component.deleteErrors[users[1].id]).toContain('permission denied');
    expect(fixture.nativeElement.querySelector('.row-error')).toBeTruthy();
  });

  it('names the user in row action accessible labels', () => {
    fixture.detectChanges();
    settle(users);

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.user-actions button'),
    ).map((button: Element) => button.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Edit Alan Turing',
      'Delete Alan Turing',
      'Edit Grace Hopper',
      'Delete Grace Hopper',
      'Edit Ada Lovelace',
      'Delete Ada Lovelace',
    ]);
  });

  it('renders the role history empty state', () => {
    fixture.detectChanges();
    settle(users);

    const empty = fixture.nativeElement.querySelector('[data-testid="admin-role-history-empty"]');
    expect(empty?.textContent?.trim()).toBe('No role changes yet.');
  });

  it('renders role history newest first with actor, target, and before/after roles', () => {
    fixture.detectChanges();
    settle(users);
    roleAuditSource.next([
      {
        actorId: 'user-2', targetId: 'user-3', targetEmail: 'user3@example.com',
        before: { admin: false, super: false }, after: { admin: true, super: false }, at: 1000,
      },
      {
        actorId: 'user-1', targetId: 'user-2', targetEmail: 'user2@example.com',
        before: { admin: true, super: false }, after: { admin: true, super: true }, at: 2000,
      },
    ]);
    fixture.detectChanges();

    expect(component.roleHistory.map(entry => entry.at)).toEqual([2000, 1000]);
    const rows = fixture.nativeElement.querySelectorAll('.role-history-table tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Ada Lovelace');
    expect(rows[0].textContent).toContain('user2@example.com');
    expect(rows[0].textContent).toContain('Admin');
    expect(rows[0].textContent).toContain('Super');
  });

  it('includes the pending upload count in the delete confirmation', async () => {
    fixture.detectChanges();
    settle(users);
    pendingUploadsSource.next([
      { uploader: { email: 'user1@example.com' } },
      { uploader: { email: 'USER1@example.com' } },
      { uploader: { email: 'someone@example.com' } },
    ]);

    await component.deleteUser(users[0]);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Delete Ada Lovelace? This cannot be undone. 2 pending uploads reference this member.',
    }));
  });

  it('still asks for delete confirmation when the pending upload read fails', async () => {
    fixture.detectChanges();
    settle(users);
    pendingUploadsSource.error(new Error('permission denied'));

    await component.deleteUser(users[0]);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Delete Ada Lovelace? This cannot be undone.',
    }));
  });

  it('renders the error state and retries the subscription', () => {
    const failing = throwError(() => new Error('offline'));
    adminService.allUsersObservable = failing;
    component.retry();
    fixture.detectChanges();

    expect(component.state).toBe('error');
    expect(fixture.nativeElement.querySelector('.admin-error')).toBeTruthy();

    adminService.allUsersObservable = of(users);
    component.retry();
    fixture.detectChanges();

    expect(component.state).toBe('ready');
    expect(fixture.nativeElement.querySelectorAll('.admin-table tbody tr')).toHaveLength(3);
  });
});
