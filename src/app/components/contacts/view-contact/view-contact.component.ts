import { Component, OnInit, Input } from '@angular/core';
import { Contact } from 'src/app/models/contact';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-view-contact',
  templateUrl: './view-contact.component.html',
  styleUrls: ['./view-contact.component.scss']
})
export class ViewContactComponent implements OnInit {
  @Input() contact: Contact;
  user: User;

  constructor(public auth: AuthService) { }

  ngOnInit(): void {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user
    )
  }
}
