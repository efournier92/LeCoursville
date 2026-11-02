import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { User } from 'src/app/models/user';

@Component({
    selector: 'app-user-view',
    templateUrl: './user-view.component.html',
    styleUrls: ['./user-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UserViewComponent {
  @Input() userOnCard: User;

  // PUBLIC METHODS

  get initials(): string {
    const name = this.userOnCard?.name?.trim();
    if (!name) {
      return "?";
    }
    const parts = name.split(/\s+/);
    const first = parts[0]?.charAt(0) || "";
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

  shouldDisplayRoles(): boolean {
    return this.isAdminUser();
  }

  isAdminUser(): boolean {
    return this.userOnCard?.roles?.admin === true || this.userOnCard?.roles?.super === true;
  }

  isSuperUser(): boolean {
    return this.userOnCard?.roles?.super === true;
  }

  shouldDisplayContentAdminBadge(): boolean {
    return this.isAdminUser();
  }

  shouldDisplaySuperBadge(): boolean {
    return this.isSuperUser();
  }

  shouldDisplayUserId(): boolean {
    return this.isAdminUser() || this.isSuperUser();
  }
}
