import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { User } from 'src/app/models/user';

@Component({
  selector: 'app-user-view',
  templateUrl: './user-view.component.html',
  styleUrls: ['./user-view.component.scss']
})
export class UserViewComponent implements OnInit {
  @Input() userOnCard: User;

  @Output() editClickedEvent = new EventEmitter();

  constructor() { }

  // LIFECYCLE HOOKS

  ngOnInit(): void { }

  // PUBLIC METHODS

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
