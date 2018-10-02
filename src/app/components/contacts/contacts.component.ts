import { Component, OnInit } from '@angular/core';
import { FilterPipe } from 'ngx-filter-pipe';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import { Contact } from 'src/app/components/contacts/contact';
import { ContactsService } from './contacts.service';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  user: User;
  contacts: Contact[] = [];
  searchTerm: string = '';
  filteredContacts: Contact[] = [];
  family: string = '';
  families: string[] = [];

  constructor(
    private contactsService: ContactsService,
    private filter: FilterPipe,
    private auth: AuthService,
  ) { }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      });

    this.contactsService.userContacts.subscribe(contacts => {
      this.contacts = contacts;

      this.filteredContacts = contacts.sort((a, b) => a.name > b.name ? 1 : -1);
      // this.contactsService.changeEmails(this.contacts);
      // this.contactsService.changePhones(this.contacts);
      this.getFamilies();
    })
  }

  getFamilies() {
    for (let contact of this.contacts) {
      if (!this.families.includes(contact.family)) this.families.push(contact.family);
    }
  }

  switchFamily(family: string) {
    this.filteredContacts = this.filter.transform(this.contacts, { family: family });
  }

  newContact() {
    let contact = new Contact();
    this.contactsService.newContact(contact);
  }

  filterContacts(event: any) {
    this.filteredContacts = this.filter.transform(this.contacts, { name: event.target.value });
  }

  clearFamily() {
    this.family = '';
  }

  updateContact(contact) {
    console.log(contact);
    this.contactsService.updateContact(contact);
  }

  printPdf() {
    this.contactsService.printPdf(this.filteredContacts, 'print');
  }

  downloadPdf() {
    this.contactsService.printPdf(this.filteredContacts, 'download');
  }
}
