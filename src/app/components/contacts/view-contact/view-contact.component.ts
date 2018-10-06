import { Component, OnInit, Input } from '@angular/core';
import { Contact } from 'src/app/components/contacts/contact';
import { User } from 'src/app/components/auth/user';
import { AuthService } from 'src/app/components/auth/auth.service';

@Component({
  selector: 'app-view-contact',
  templateUrl: './view-contact.component.html',
  styleUrls: ['./view-contact.component.scss']
})
export class ViewContactComponent implements OnInit {
  @Input() contact: Contact;
  user: User;

  constructor(public auth: AuthService) { }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user
    )
  }

}
