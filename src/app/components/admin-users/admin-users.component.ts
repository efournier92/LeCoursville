import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { AdminService, RoleAuditRecord } from 'src/app/services/admin.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { RtdbService } from 'src/app/services/rtdb.service';
import { User } from 'src/app/models/user';
import { UserUpload } from 'src/app/models/user-upload';
import { SortSettingsForUsers } from 'src/app/models/sort-settings-for-users';
import { Page, paginate, pageRange } from 'src/app/admin/pagination';
import { UserEditComponent } from 'src/app/components/user-edit/user-edit.component';

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
  deleteErrors: Record<string, string> = {};
  roleHistory: RoleAuditRecord[] = [];
  readonly pageSize = 10;
  readonly roleHistoryLimit = 20;
  sortPropertyText = '';
  activeSortKey = '';
  private rolesByUserId = new Map<string, string[]>();
  private usersById = new Map<string, User>();
  private displayedPage: Page<User> = { items: [], total: 0, page: 1, pageCount: 1, pageSize: 10 };

  private usersSubscription?: Subscription;
  private roleAuditSubscription?: Subscription;

  constructor(
    private adminService: AdminService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private rtdb: RtdbService,
  ) { }

  ngOnInit(): void {
    this.initializeSortSettings();
    this.restoreState();
    this.loadUsers();
    this.loadRoleHistory();
  }

  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
    this.roleAuditSubscription?.unsubscribe();
  }

  // PUBLIC METHODS

  openEditor(user: User): void {
    const dialogRef = this.dialog.open(UserEditComponent, {
      width: '520px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
    });
    dialogRef.componentRef?.setInput('userOnCard', user);
    dialogRef.componentRef?.setInput('isAdminMode', true);
    const closeSubscription = dialogRef.componentInstance.userSavedEvent.subscribe(() => dialogRef.close());
    const cancelSubscription = dialogRef.componentInstance.cancelEditClickedEvent.subscribe(() => dialogRef.close());
    dialogRef.afterClosed().subscribe(() => {
      closeSubscription.unsubscribe();
      cancelSubscription.unsubscribe();
    });
  }

  async deleteUser(user: User): Promise<void> {
    const pendingUploads = await this.countPendingUploads(user);
    const uploadWarning = pendingUploads === null
      ? ''
      : ` ${pendingUploads} pending ${pendingUploads === 1 ? 'upload references' : 'uploads reference'} this member.`;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete user?',
      message: `Delete ${this.displayName(user)}? This cannot be undone.${uploadWarning}`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.deleteErrors[user.id] = '';
    try {
      await this.adminService.deleteUser(user);
    } catch (error) {
      this.deleteErrors[user.id] = `Could not delete ${this.displayName(user)}: ${this.errorMessage(error)}`;
    }
  }

  retry(): void {
    this.loadUsers();
  }

  onFilterQueryChange(query: string): void {
    this.sortSettings.activeFilterQuery = query;
    this.pageIndex = 1;
    this.refreshDisplayedUsers();
    this.persistState();
  }

  previousPage(): void {
    this.pageIndex = Math.max(1, this.pageIndex - 1);
    this.refreshDisplayedUsers();
    this.persistState();
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.pageCount, this.pageIndex + 1);
    this.refreshDisplayedUsers();
    this.persistState();
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredTotal / this.pageSize));
  }

  get showingRange(): string {
    return pageRange(this.displayedPage);
  }

  userRoles(user: User): string[] {
    const roles = user?.roles || { user: false, admin: false, super: false };
    return [
      roles.admin ? 'Admin' : '',
      roles.super ? 'Super' : '',
      roles.user ? 'Member' : '',
    ].filter(Boolean);
  }

  /** Cached per displayed row so the template never allocates on a CD tick. */
  rolesFor(user: User): string[] {
    return this.rolesByUserId.get(user.id) || [];
  }

  rowName(user: User): string {
    return this.displayName(user);
  }

  actorName(entry: RoleAuditRecord): string {
    const actor = this.usersById.get(entry.actorId);
    return actor?.name?.trim() || actor?.email || entry.actorId || 'Unknown';
  }

  roleSummary(roles: { admin: boolean; super: boolean } | undefined): string {
    return [
      roles?.admin ? 'Admin' : '',
      roles?.super ? 'Super' : '',
    ].filter(Boolean).join(', ') || 'Member';
  }

  isActiveSort(key: string): boolean {
    return this.sortSettings.activeSortProperty.key === key;
  }

  // TODO: Move and abstract
  sortByDateLastActive(): void {
    this.sortBy('dateLastActive');
  }

  sortByDateRegistered(): void {
    this.sortBy('dateRegistered');
  }

  sortByName(): void {
    this.sortBy('name');
  }

  sortByEmail(): void {
    this.sortBy('email');
  }

  isSortDescending(): boolean {
    return this.sortSettings.activeDirection === this.sortSettings.sortableDirections.descending;
  }

  reverseDisplayedUsersSortOrder(): void {
    this.sortSettings.reverseSortDirection();
    this.refreshDisplayedUsers();
    this.persistState();
  }

  getSortPropertyText(): string {
    return this.sortPropertyText;
  }

  // HELPER METHODS

  private sortBy(key: string): void {
    if (this.sortSettings.activeSortProperty.key === key) {
      this.sortSettings.reverseSortDirection();
    }
    this.sortSettings.activeSortProperty = this.sortSettings.getSortPropertyByKey(key);
    this.syncSortPresentation();
    this.refreshDisplayedUsers();
    this.persistState();
  }

  private initializeSortSettings(): void {
    this.sortSettings = new SortSettingsForUsers();
    this.syncSortPresentation();
  }

  private syncSortPresentation(): void {
    this.activeSortKey = this.sortSettings.activeSortProperty.key;
    this.sortPropertyText =
      this.sortSettings.getSortPropertyByKey(this.activeSortKey)?.title || '';
  }

  private restoreState(): void {
    const params = this.route.snapshot.queryParamMap;
    const query = params.get('q');
    if (query) {
      this.sortSettings.activeFilterQuery = query;
    }
    const sort = params.get('sort');
    if (sort) {
      this.sortSettings.activeSortProperty =
        this.sortSettings.getSortPropertyByKey(sort) || this.sortSettings.activeSortProperty;
    }
    const direction = params.get('dir');
    if (direction === this.sortSettings.sortableDirections.ascending) {
      this.sortSettings.activeDirection = this.sortSettings.sortableDirections.ascending;
    } else if (direction === this.sortSettings.sortableDirections.descending) {
      this.sortSettings.activeDirection = this.sortSettings.sortableDirections.descending;
    }
    const page = Number(params.get('page'));
    if (Number.isInteger(page) && page > 0) {
      this.pageIndex = page;
    }
    this.syncSortPresentation();
  }

  private persistState(): void {
    const query = (this.sortSettings.activeFilterQuery || '').trim();
    const isDefaultSort = this.sortSettings.activeSortProperty.key === 'dateLastActive';
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        q: query || null,
        sort: isDefaultSort ? null : this.sortSettings.activeSortProperty.key,
        dir: this.isSortDescending() ? null : this.sortSettings.sortableDirections.ascending,
        page: this.pageIndex > 1 ? this.pageIndex : null,
      },
    });
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
        this.usersById = new Map(users.map(user => [user.id, user]));
        this.refreshDisplayedUsers();
        this.state = 'ready';
      },
      error: () => {
        this.state = 'error';
      },
    });
  }

  private loadRoleHistory(): void {
    this.roleAuditSubscription?.unsubscribe();
    this.roleAuditSubscription = this.rtdb.list<RoleAuditRecord>('roleAudit').valueChanges().subscribe({
      next: (entries: RoleAuditRecord[]) => {
        this.roleHistory = (entries || [])
          .slice()
          .sort((a, b) => (b.at || 0) - (a.at || 0))
          .slice(0, this.roleHistoryLimit);
      },
      // roleAudit is super-only; never break the users page if it is denied.
      error: () => {
        this.roleHistory = [];
      },
    });
  }

  private async countPendingUploads(user: User): Promise<number | null> {
    const email = (user?.email || '').trim().toLowerCase();
    if (!email) {
      return null;
    }
    try {
      const pending = await firstValueFrom(
        this.rtdb.list<UserUpload>('userUploads', [
          this.rtdb.orderByChild('status'),
          this.rtdb.equalTo('pending'),
        ]).valueChanges(),
      );
      return (pending || []).filter(
        upload => (upload.uploader?.email || '').trim().toLowerCase() === email,
      ).length;
    } catch {
      return null;
    }
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
    this.displayedPage = page;
    this.pageIndex = page.page;
    this.filteredTotal = page.total;
    this.displayedUsers = page.items;
    this.rolesByUserId = new Map(page.items.map(user => [user.id, this.userRoles(user)]));
  }

  private displayName(user: User): string {
    return user?.name?.trim() || user?.email || 'this user';
  }

  private errorMessage(error: unknown): string {
    return (error as Error)?.message || 'Unknown error';
  }
}
