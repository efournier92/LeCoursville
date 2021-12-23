import { Component, OnInit, Input } from '@angular/core';
import { Contact, Phone, Address, Email } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { AppSettings } from 'src/environments/app-settings';
import { ContactsService } from 'src/app/services/contacts.service';

@Component({
  selector: 'app-contact-edit',
  templateUrl: './contact-edit.component.html',
  styleUrls: ['./contact-edit.component.scss']
})
export class ContactEditComponent implements OnInit {
  @Input() contact: Contact;

  user: User;
  families: string[] = AppSettings.families;

  constructor(
    private auth: AuthService,
    private contactsService: ContactsService,
  ) { }

  ngOnInit(
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  updateContact(contact: Contact): void {
    contact.isEditable = false;
    this.contactsService.updateContact(contact);
  }

  deleteContact(contact: Contact): void {
    this.contactsService.deleteContact(contact);
  }

  addAddress(contact: Contact): void {
    if (!contact.addresses) {
      contact.addresses = new Array<Address>();
    }
    const address: Address = new Address();
    contact.addresses.push(address);
  }

  removeAddress(addresses: any, index: number): void {
    addresses.pop(index);
  }

  addPhone(contact: Contact): void {
    if (!contact.phones) {
      contact.phones = new Array<Phone>();
    }
    const phone: Phone = new Phone();
    contact.phones.push(phone);
  }

  removePhone(phones: Phone[], index: number): void {
    phones.splice(index, 1);
  }

  addEmail(contact: Contact): void {
    if (!contact.emails) {
      contact.emails = new Array<Email>();
    }
    const email: Email = new Email();
    contact.emails.push(email);
  }

  removeEmail(emails: Email[], index: number): void {
    emails.splice(index, 1);
  }
}
