import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { User } from 'src/app/models/user';

@Component({
    selector: 'app-user-view',
    templateUrl: './user-view.component.html',
    styleUrls: ['./user-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UserViewComponent implements OnInit {
  @Input() userOnCard: User;

  @Output() editClickedEvent = new EventEmitter();

  constructor() { }

  // LIFECYCLE HOOKS

  ngOnInit(): void { }

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

  onEdit(): void {
    this.editClickedEvent.emit();
  }

  isAdminUser(): boolean {
    return this.userOnCard?.roles?.admin;
  }

  isSuperUser(): boolean {
    return this.userOnCard?.roles?.super;
  }

  shouldDisplayUserId(): boolean {
    return this.isAdminUser() || this.isSuperUser();
  }
}
