import { Component, OnInit, Input } from '@angular/core';
import { Contact } from 'src/app/models/contact';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-contact-view',
  templateUrl: './contact-view.component.html',
  styleUrls: ['./contact-view.component.scss']
})
export class ContactViewComponent implements OnInit {
  @Input() contact: Contact;

  user: User;

  constructor(public authService: AuthService) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }
}
