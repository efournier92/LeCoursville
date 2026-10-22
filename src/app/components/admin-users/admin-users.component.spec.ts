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

  const users = [
    makeUser(1, 'Ada Lovelace'),
    makeUser(2, 'Grace Hopper'),
    makeUser(3, 'Alan Turing'),
  ];

  beforeEach(async () => {
    usersSource = new BehaviorSubject<unknown>({});
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
      message: 'Delete Ada Lovelace? This cannot be undone.',
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
