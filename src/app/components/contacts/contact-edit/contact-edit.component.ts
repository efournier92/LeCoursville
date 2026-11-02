import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Contact, Phone, Address, Email } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { FamilyService, FamiliesStatus } from 'src/app/services/family.service';
import { Family } from 'src/app/models/family';
import { ContactsService } from 'src/app/services/contacts.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { ArrayService } from 'src/app/services/array.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
    selector: 'app-contact-edit',
    templateUrl: './contact-edit.component.html',
    styleUrls: ['./contact-edit.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ContactEditComponent implements OnInit, OnDestroy {
  @Input() contact: Contact;

  user: User;
  families: Family[] = [];
  familiesStatus: FamiliesStatus = 'loading';

  private familiesSub: Subscription | null = null;
  private familiesStatusSub: Subscription | null = null;

  // minimalism: read-only role projection, not a form field.
  get canDelete(): boolean {
    return this.user?.roles?.admin === true;
  }

  get legacyFamily(): string | null {
    const stored = this.contact?.family?.trim();
    if (!stored) return null;
    return this.families.some(family => this.compareFamily(family.name, stored)) ? null : stored;
  }

  constructor(
    private authService: AuthService,
    private familyService: FamilyService,
    private contactsService: ContactsService,
    private analyticsService: AnalyticsService,
    private arrayService: ArrayService,
    private confirmDialog: ConfirmDialogService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit() {
    this.subscribeToUserObservable();
    this.subscribeToFamilies();
    this.analyticsService.logEvent('component_load_contacts_edit', { });
  }

  ngOnDestroy(): void {
    this.familiesSub?.unsubscribe();
    this.familiesStatusSub?.unsubscribe();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private subscribeToFamilies(): void {
    // The service BehaviorSubject replays its [] seed synchronously; that is
    // still loading, not empty.
    let familiesSeed = true;
    this.familiesSub = this.familyService.families$.subscribe(families => {
      const seedEmpty = familiesSeed && families.length === 0;
      familiesSeed = false;
      if (seedEmpty) return;
      this.families = [...families].sort((a, b) => (a.sortOrder ?? '').localeCompare(b.sortOrder ?? '') || a.name.localeCompare(b.name));
    });
    this.familiesStatusSub = this.familyService.familiesStatus$.subscribe(status => {
      this.familiesStatus = status;
    });
  }

  // PUBLIC METHODS

  compareFamily(a: string, b: string): boolean {
    return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  }

  updateContact(contact: Contact): void {
    contact.isEditable = false;
    this.contactsService.updateContact(contact);
    this.analyticsService.logEvent('contacts_update', {
      id: contact?.id, name: contact?.name,
      userId: this.user?.id,
    });
  }

  async deleteContact(contact: Contact): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete contact?',
      message: `Delete ${contact?.name || 'this contact'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
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
    addresses = this.arrayService.removeByIndex(addresses, index);

    this.analyticsService.logEvent('contacts_remove_address', {
      removedAddress: addresses[index], userId: this.user?.id,
    });
  }

  removePhone(phones: Phone[], index: number): void {
    phones = this.arrayService.removeByIndex(phones, index);

    this.analyticsService.logEvent('contacts_remove_phone', {
      removedAddress: phones[index], userId: this.user?.id,
    });
  }

  removeEmail(emails: Email[], index: number): void {
    emails = this.arrayService.removeByIndex(emails, index);

    this.analyticsService.logEvent('contacts_remove_email', {
      removedAddress: emails[index], userId: this.user?.id,
    });
  }
}
