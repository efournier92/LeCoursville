import { Component, OnInit, Input } from '@angular/core';
import { Contact, Phone, Address, Email } from '../contact';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/user';
import { families } from 'src/app/components/contacts/families';
import { isType } from '@angular/core/src/type';
import { ContactsService } from '../contacts.service';

@Component({
  selector: 'app-edit-contact',
  templateUrl: './edit-contact.component.html',
  styleUrls: ['./edit-contact.component.scss']
})
export class EditContactComponent implements OnInit {
  @Input() public contact: Contact;
  user: User;
  families: string[] = families;

  constructor(
    private auth: AuthService,
    private contactsService: ContactsService,
  ) { }

  ngOnInit(
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user
    )
  }

  updateContact(contact) {
    contact.editable = false;
    this.contactsService.updateContact(contact);
  }

  deleteContact(contact) {
    this.contactsService.deleteContact(contact);
  }

  addAddress(contact) {
    if (!contact.addresses)
      contact.addresses = new Array<Address>();
    let address = new Address();
    contact.addresses.push(address);
  }

  removeAddress(addresses, index) {
    addresses.pop(index);
  }

  addPhone(contact) {
    if (!contact.phones)
      contact.phones = new Array<Phone>();
    let phone = new Phone();
    contact.phones.push(phone);
  }

  removePhone(phones, index) {
    phones.pop(index);
  }

  addEmail(contact) {
    if (!contact.emails)
      contact.emails = new Array<Email>();
    let email = new Email();
    contact.emails.push(email);
  }

  removeEmail(emails, index) {
    emails.pop(index);
  }
}
