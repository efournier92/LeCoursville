import { Component, OnInit, Input } from '@angular/core';
import { Contact, Phone, Address, Email } from '../contact';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/user';
import { families } from 'src/app/contacts/families';
import { ContactsService } from '../contacts.service';

@Component({
  selector: 'app-edit-contact',
  templateUrl: './edit-contact.component.html',
  styleUrls: ['./edit-contact.component.scss']
})
export class EditContactComponent implements OnInit {
  @Input()
  public contact: Contact;
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

  updateContact(contact: Contact): void {
    contact.isEditable = false;
    this.contactsService.updateContact(contact);
  }

  deleteContact(contact: Contact): void {
    this.contactsService.deleteContact(contact);
  }

  addAddress(contact: Contact): void {
    if (!contact.addresses)
      contact.addresses = new Array<Address>();
    let address: Address = new Address();
    contact.addresses.push(address);
  }

  removeAddress(addresses: any, index: number): void {
    addresses.pop(index);
  }

  addPhone(contact: Contact): void {
    if (!contact.phones)
      contact.phones = new Array<Phone>();
    let phone: Phone = new Phone();
    contact.phones.push(phone);
  }

  removePhone(phones: Phone[], index: number): void {
    phones.splice(index, 1);
  }

  addEmail(contact: Contact): void {
    if (!contact.emails)
      contact.emails = new Array<Email>();
    let email: Email = new Email();
    contact.emails.push(email);
  }

  removeEmail(emails: Email[], index: number): void {
    emails.splice(index, 1);
  }
}