import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { AdminService } from 'src/app/services/admin.service';
import { User } from 'src/app/models/user';
import { UserSortService } from 'src/app/services/user-sort.service';
import { SortSettings } from 'src/app/models/sort-settings';
import { SortingConstants } from 'src/app/constants/sorting-constants';
import { PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  user: User;
  allUsers: User[];
  displayedUsers: User[];
  sortSettings: SortSettings;
  hasUpdated: boolean;
  totalUsers: number;
  totalFilteredUsers: number;
  isLoading: boolean;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private userSortService: UserSortService,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();

    this.isLoading = true;

    this.initializeSortSettings();
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
    this.sortSettings.filterQuery = query;
    this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
  }

  doesAnyValueIncludeQuery(values: string[], query: string): boolean {
    let output = false;

    for (const value of values) {
      if (this.doesValueIncludeQuery(value, query)) {
        output = true;
        break;
      }
    }

    return output;
  }

  doesValueIncludeQuery(value: string, query: string): boolean {
    return value.toLowerCase().includes(query.toLocaleLowerCase());
  }

  shouldDisplayUserCards(): boolean {
    return this.user?.roles?.super && this.allUsers?.length > 0 && !this.isLoading;
  }

  onCancelEdit(): void {
    this.getAllUsers();
  }

  sortByDateLastActive(): void {
    if (this.sortSettings.sortProperty === SortingConstants.Users.properties.dateLastActive.key) {
      this.reverseSortDirection();
    }
    this.sortSettings.sortProperty = SortingConstants.Users.properties.dateLastActive.key;
    this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
  }

  sortByDateRegistered(): void {
    if (this.sortSettings.sortProperty === SortingConstants.Users.properties.dateRegistered.key) {
      this.reverseSortDirection();
    }
    this.sortSettings.sortProperty = SortingConstants.Users.properties.dateRegistered.key;
    this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
  }

  sortByName(): void {
    if (this.sortSettings.sortProperty === SortingConstants.Users.properties.name.key) {
      this.reverseSortDirection();
    }
    this.sortSettings.sortProperty = SortingConstants.Users.properties.name.key;
    this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
  }

  sortByEmail(): void {
    if (this.sortSettings.sortProperty === SortingConstants.Users.properties.email.key) {
      this.reverseSortDirection();
    }
    this.sortSettings.sortProperty = SortingConstants.Users.properties.email.key;
    this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
  }

  getTotalUsers(): number {
    return this.totalFilteredUsers;
  }

  setTotalUsers(totalFilteredUsers: number): void {
    this.totalFilteredUsers = totalFilteredUsers;
  }


  onUpdateUserRange(event: PageEvent): void {
    this.sortSettings.currentPageIndex = event.pageIndex;
    this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
  }

  isSortDescending(): boolean {
    return this.sortSettings.direction === SortingConstants.Directions.descending;
  }

  reverseDisplayedUsersSortOrder(): void {
    this.reverseSortDirection();

    this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
  }

  getSortPropertyText(): string {
    return SortingConstants.Users.properties[this.sortSettings.sortProperty].value;
  }

  // HELPER METHODS

  private initializeSortSettings(): void {
    const sortDirection = SortingConstants.Directions.descending;
    const sortProperty = SortingConstants.Users.properties.dateLastActive;
    const filterQuery = '';
    const usersPerPage = 10;
    const currentPageIndex = 0;

    this.sortSettings = new SortSettings(sortDirection, sortProperty.key, filterQuery, usersPerPage, currentPageIndex);
  }

  private getAllUsers(): void {
    this.adminService.allUsersObservable.subscribe(
      (users: User[]) => {
        if (users.length && users.length !== this.totalUsers) {
          this.allUsers = users;
          this.displayedUsers = this.refreshDisplayedUsers(this.allUsers, this.sortSettings);
          this.totalUsers = users.length;
          this.isLoading = false;
        }
      }
    );
  }

  // TODO: Abstract below into generic search service

  private refreshDisplayedUsers(usersToSort: User[], sortSettings: SortSettings): User[] {
    let users: User[];

    if (!usersToSort?.length) { return usersToSort; }

    users = this.filterUsers(usersToSort, sortSettings.filterQuery);
    users = this.sortUsers(users, sortSettings);
    users = this.displayUserPage(users, sortSettings);

    return users;
  }

  private filterUsers(usersToSort: User[], query: string): User[] {
    if (!usersToSort.length) { return usersToSort; }

    const output = usersToSort.filter(
      (user: User) => {
        return this.doesAnyValueIncludeQuery([user.id, user.name, user.email], query);
      }
    );

    this.setTotalUsers(output.length);

    return output;
  }

  private sortUsers(users: User[], sortSettings: SortSettings): User[] {
    const sortResponse = this.userSortService.sort(users, sortSettings);
    this.sortSettings = sortResponse.settings;

    return sortResponse.users;
  }

  private displayUserPage(users: User[], sortSettings: SortSettings): User[] {
    let output: User[];

    const start = sortSettings.currentPageIndex === 0 ? 0 : sortSettings.currentPageIndex * sortSettings.usersPerPage;
    const end = start + sortSettings.usersPerPage;

    if (users.length) {
      output = users?.slice(start, end);
    }

    return output;
  }

  private reverseSortDirection(): void {
    this.sortSettings.direction =
      this.sortSettings.direction === SortingConstants.Directions.ascending
        ? SortingConstants.Directions.descending
        : SortingConstants.Directions.ascending;
  }
}
