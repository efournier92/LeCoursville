import { Component, OnInit, Input } from '@angular/core';
import { Contact, Phone, Address, Email } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { AppSettings } from 'src/environments/app-settings';
import { ContactsService } from 'src/app/services/contacts.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

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
    private authService: AuthService,
    private contactsService: ContactsService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit() {
    this.subscribeToUserObservable();
    this.analyticsService.logEvent('component_load_contacts_edit', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  updateContact(contact: Contact): void {
    contact.isEditable = false;
    this.contactsService.updateContact(contact);
    this.analyticsService.logEvent('contacts_update', {
      id: contact?.id, name: contact?.name,
      userId: this.user?.id,
    });
  }

  deleteContact(contact: Contact): void {
    this.contactsService.deleteContact(contact);
    this.analyticsService.logEvent('contacts_delete', {
      id: contact?.id, name: contact?.name,
      userId: this.user?.id,
    });
  }

  addAddress(contact: Contact): void {
    if (!contact.addresses) {
      contact.addresses = [];
    }

    const address: Address = new Address();
    contact.addresses.push(address);

    this.analyticsService.logEvent('contacts_add_address', {
      id: contact?.id, name: contact?.name,
      value: address, userId: this.user?.id,
    });
  }

  addPhone(contact: Contact): void {
    if (!contact.phones) {
      contact.phones = [];
    }
    const phone: Phone = new Phone();
    contact.phones.push(phone);

    this.analyticsService.logEvent('contacts_add_phone', {
      id: contact?.id, name: contact?.name, value: phone.info,
      userId: this.user?.id,
    });
  }

  addEmail(contact: Contact): void {
    if (!contact.emails) {
      contact.emails = [];
    }

    const email: Email = new Email();
    contact.emails.push(email);

    this.analyticsService.logEvent('contacts_add_email', {
      id: contact?.id, name: contact?.name, newEmail: email,
      userId: this.user?.id,
    });
  }

  removeAddress(addresses: any, index: number): void {
    addresses.pop(index);

    this.analyticsService.logEvent('contacts_remove_address', {
      removedAddress: addresses[index], userId: this.user?.id,
    });
  }

  removePhone(phones: Phone[], index: number): void {
    phones.splice(index, 1);

    this.analyticsService.logEvent('contacts_remove_phone', {
      removedAddress: phones[index], userId: this.user?.id,
    });
  }

  removeEmail(emails: Email[], index: number): void {
    emails.splice(index, 1);

    this.analyticsService.logEvent('contacts_remove_email', {
      removedAddress: emails[index], userId: this.user?.id,
    });
  }
}
