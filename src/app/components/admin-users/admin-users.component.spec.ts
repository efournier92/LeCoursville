import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
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
  let adminService: { allUsersObservable: unknown; updateUser: ReturnType<typeof vi.fn> };

  const users = [
    makeUser(1, 'Ada Lovelace'),
    makeUser(2, 'Grace Hopper'),
    makeUser(3, 'Alan Turing'),
  ];

  beforeEach(async () => {
    usersSource = new BehaviorSubject<unknown>({});
    adminService = {
      allUsersObservable: usersSource.asObservable(),
      updateUser: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        { provide: AdminService, useValue: adminService },
        {
          provide: AuthService,
          useValue: { userObservable: of({}), isUserAdmin: () => true },
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

  it('shows a skeleton until the user list resolves, then the cards', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.admin-skeleton-rows')).toBeTruthy();

    settle(users);

    expect(fixture.nativeElement.querySelector('.admin-skeleton-rows')).toBeFalsy();
    expect(fixture.nativeElement.querySelectorAll('app-user-edit')).toHaveLength(3);
    expect(component.showingRange).toBe('Showing 1-3 of 3');
  });

  it('renders the empty state when there are no users', () => {
    fixture.detectChanges();
    settle([]);

    expect(component.state).toBe('ready');
    expect(fixture.nativeElement.querySelector('app-no-results-message')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('app-user-edit')).toHaveLength(0);
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

  it('renders the error state and retries the subscription', () => {
    const failing = throwError(() => new Error('offline'));
    adminService.allUsersObservable = failing;
    component.retry();
    fixture.detectChanges();

    expect(component.state).toBe('error');
    expect(fixture.nativeElement.querySelector('app-load-error')).toBeTruthy();

    adminService.allUsersObservable = of(users);
    component.retry();
    fixture.detectChanges();

    expect(component.state).toBe('ready');
    expect(fixture.nativeElement.querySelectorAll('app-user-edit')).toHaveLength(3);
  });
});
