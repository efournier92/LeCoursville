import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-user-view',
  templateUrl: './user-view.component.html',
  styleUrls: ['./user-view.component.scss']
})
export class UserViewComponent implements OnInit {
  @Input() user: User;

  @Output() editClickedEvent = new EventEmitter();

  constructor() { }

  // LIFECYCLE HOOKS

  ngOnInit(): void { }

  // PUBLIC METHODS

  shouldSeeRoles(): boolean {
    return this.isAdminUser();
  }

  onEdit(): void {
    this.editClickedEvent.emit();
  }

  isAdminUser(): boolean {
    return this.user?.roles?.admin;
  }

  isSuperUser(): boolean {
    return this.user?.roles?.super;
  }
}
