import { Component, OnInit } from '@angular/core';
import { FilterPipe } from 'ngx-filter-pipe';
import { Contact } from 'src/app/models/contact';
import { AppSettings } from 'src/environments/app-settings';
import { AuthService } from 'src/app/services/auth.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { User } from 'src/app/models/user';
import { ConfirmPromptService } from 'src/app/services/confirm-prompt.service';
import { ContactsPrinterService } from 'src/app/services/contacts-printer.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  user: User;
  contacts: Contact[] = [];
  searchTerm = '';
  filteredContacts: Contact[] = [];
  family = '';
  families: string[] = AppSettings.families;

  constructor(
    private contactsService: ContactsService,
    private contactsPrinterService: ContactsPrinterService,
    private filter: FilterPipe,
    private authService: AuthService,
    private confirmPrompt: ConfirmPromptService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.subscribeToContactsObservable();
    this.analyticsService.logEvent('component_load_contacts', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private subscribeToContactsObservable() {
    this.contactsService.userContacts.subscribe(contacts => {
      this.contacts = contacts;
      this.filteredContacts = contacts.sort((a, b) => a.name > b.name ? 1 : -1);
    });
  }

  // PUBLIC METHODS

  filterContacts(event: any): void {
    this.filteredContacts = this.filter.transform(this.contacts, { name: event.target.value });
    this.analyticsService.logEvent('contacts_filter', { filtrationEvent: event, filtrationValue: event.target.value, user: this.user.id });
  }

  downloadPdf(): void {
    this.contactsPrinterService.downloadPdf(this.filteredContacts);
    this.analyticsService.logEvent('contacts_pdf_download', { filteredContracts: this.filteredContacts, user: this.user.id });
  }

  printPdf(): void {
    this.contactsPrinterService.printPdf(this.filteredContacts);
    this.analyticsService.logEvent('contacts_pdf_print', { filteredContracts: this.filteredContacts, user: this.user.id });
  }

  switchFamily(family: string): void {
    this.filteredContacts = this.filter.transform(this.contacts, { family });
    this.analyticsService.logEvent('contacts_switch_family', { filteredContracts: this.filteredContacts, user: this.user.id });
  }

  newContact(): void {
    const dialogRef = this.confirmPrompt.openDialog(
      'Are You Sure?',
      'Do you want to add this contact to LeCoursville?',
    );

    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          const contact: Contact = new Contact();
          this.contactsService.newContact(contact);
          this.analyticsService.logEvent('contacts_new_create', { newContact: contact, user: this.user.id });
        }
      }
    );
  }

}
