import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminService } from 'src/app/services/admin.service';
import { User } from 'src/app/models/user';
import { SortSettingsForUsers } from 'src/app/models/sort-settings-for-users';
import { paginate } from 'src/app/admin/pagination';

type UsersState = 'loading' | 'ready' | 'error';

@Component({
    selector: 'app-admin-users',
    templateUrl: './admin-users.component.html',
    styleUrls: ['./admin-users.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  allUsers: User[] = [];
  displayedUsers: User[] = [];
  sortSettings: SortSettingsForUsers;
  state: UsersState = 'loading';
  pageIndex = 1;
  filteredTotal = 0;
  readonly pageSize = 10;

  private usersSubscription?: Subscription;

  constructor(private adminService: AdminService) { }

  ngOnInit(): void {
    this.initializeSortSettings();
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
  }

  // PUBLIC METHODS

  updateUser(user: User): void {
    this.adminService.updateUser(user);
  }

  retry(): void {
    this.loadUsers();
  }

  onFilterQueryChange(query: string): void {
    this.sortSettings.activeFilterQuery = query;
    this.pageIndex = 1;
    this.refreshDisplayedUsers();
  }

  previousPage(): void {
    this.pageIndex = Math.max(1, this.pageIndex - 1);
    this.refreshDisplayedUsers();
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.pageCount, this.pageIndex + 1);
    this.refreshDisplayedUsers();
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredTotal / this.pageSize));
  }

  get showingRange(): string {
    if (this.filteredTotal === 0) {
      return 'Showing 0 of 0';
    }
    const start = (this.pageIndex - 1) * this.pageSize + 1;
    const end = start + this.displayedUsers.length - 1;
    return `Showing ${start}-${end} of ${this.filteredTotal}`;
  }

  // TODO: Move and abstract
  sortByDateLastActive(): void {
    if (this.sortSettings.activeSortProperty.key === 'dateLastActive') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('dateLastActive');
    this.refreshDisplayedUsers();
  }

  sortByDateRegistered(): void {
    if (this.sortSettings.activeSortProperty.key === 'dateRegistered') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('dateRegistered');
    this.refreshDisplayedUsers();
  }

  sortByName(): void {
    if (this.sortSettings.activeSortProperty.key === 'name') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('name');
    this.refreshDisplayedUsers();
  }

  sortByEmail(): void {
    if (this.sortSettings.activeSortProperty.key === 'email') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('email');
    this.refreshDisplayedUsers();
  }

  isSortDescending(): boolean {
    return this.sortSettings.activeDirection === this.sortSettings.sortableDirections.descending;
  }

  reverseDisplayedUsersSortOrder(): void {
    this.sortSettings.reverseSortDirection();
    this.refreshDisplayedUsers();
  }

  getSortPropertyText(): string {
    return this.sortSettings.getSortPropertyByKey(this.sortSettings.activeSortProperty.key)?.title || '';
  }

  // HELPER METHODS

  private initializeSortSettings(): void {
    this.sortSettings = new SortSettingsForUsers();
  }

  private loadUsers(): void {
    this.usersSubscription?.unsubscribe();
    this.state = 'loading';
    this.usersSubscription = this.adminService.allUsersObservable.subscribe({
      next: (users: User[]) => {
        // The service seeds the stream with an empty object; wait for the list.
        if (!Array.isArray(users)) {
          return;
        }
        this.allUsers = users;
        this.refreshDisplayedUsers();
        this.state = 'ready';
      },
      error: () => {
        this.state = 'error';
      },
    });
  }

  private refreshDisplayedUsers(): void {
    const query = (this.sortSettings.activeFilterQuery || '').trim().toLowerCase();
    const filterKeys = this.sortSettings.sortableProperties.map(prop => prop.key);
    const filtered = query
      ? (this.allUsers || []).filter(user =>
          filterKeys.some(key => String(user[key] ?? '').toLowerCase().includes(query)))
      : [...(this.allUsers || [])];
    const sorted = this.sortSettings.sortItems(filtered);
    const page = paginate(sorted, this.pageIndex, this.pageSize);
    this.pageIndex = page.page;
    this.filteredTotal = page.total;
    this.displayedUsers = page.items;
  }
}
