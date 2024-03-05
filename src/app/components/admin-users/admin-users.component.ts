import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { AdminService } from 'src/app/services/admin.service';
import { User } from 'src/app/models/user';
import { SortSettingsForUsers } from 'src/app/models/sort-settings-for-users';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  user: User;
  allUsers: User[];
  displayedUsers: User[];
  sortSettings: SortSettingsForUsers;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
  ) { }

  ngOnInit(): void {
    this.initializeSortSettings();
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        if (this.user?.roles?.super) {
          this.getAllUsers();
        }
      }
    );
  }

  // PUBLIC METHODS

  updateUser(user: User): void {
    this.adminService.updateUser(user);
  }

  deleteUser(user: User): void {
    this.adminService.deleteUser(user);
  }

  onFilterQueryChange(query: string): void {
    this.sortSettings.activeFilterQuery = query;
    this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
  }

  shouldDisplayUserCards(): boolean {
    return this.user?.roles?.super && this.allUsers?.length > 0;
  }

  onCancelEdit(): void {
    this.getAllUsers();
  }

  // TODO: Move and abstract
  sortByDateLastActive(): void {
    if (this.sortSettings.activeSortProperty.key === 'dateLastActive') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('dateLastActive');
    this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
  }

  sortByDateRegistered(): void {
    if (this.sortSettings.activeSortProperty.key === 'dateRegistered') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('dateRegistered');
    this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
  }

  sortByName(): void {
    if (this.sortSettings.activeSortProperty.key === 'name') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('name');
    this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
  }

  sortByEmail(): void {
    if (this.sortSettings.activeSortProperty.key === 'email') {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey('email');
    this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
  }

  onUpdateUserRange(event: PageEvent): void {
    this.sortSettings.currentPageIndex = event.pageIndex;
    this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
  }

  isSortDescending(): boolean {
    return this.sortSettings.activeDirection === this.sortSettings.sortableDirections.descending;
  }

  reverseDisplayedUsersSortOrder(): void {
    this.sortSettings.reverseSortDirection();

    this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
  }

  getSortPropertyText(): string {
    return this.sortSettings.getSortPropertyByKey(this.sortSettings.activeSortProperty.key)?.title || '';
  }

  // HELPER METHODS

  private initializeSortSettings(): void {
    this.sortSettings = new SortSettingsForUsers();
  }

  private getAllUsers(): void {
    this.adminService.allUsersObservable.subscribe(
      (users: User[]) => {
        if (users.length && users.length !== this.sortSettings.totalItems) {
          if (!this.sortSettings?.activeFilterQuery) { this.initializeSortSettings(); }
          this.allUsers = users;
          this.displayedUsers = this.sortSettings.getItemsToDisplay(this.allUsers);
          this.sortSettings.totalItems = users.length;
        }
      }
    );
  }
}
