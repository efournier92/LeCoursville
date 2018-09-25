import { Component, OnInit } from '@angular/core';
import { DataService } from '../../services/data.service'
import { FilterPipe } from 'ngx-filter-pipe';

declare var require: any

class Phone {
  number: string;
  type: string;

  constructor(phone) {
    this.number = phone.number;
    this.type = phone.type;
  }
}

export class Contact {
    id: string;
    name: string;
    family: string;
    email: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    info: string = '';
    phones: Phone[] = [];
    searchTerm: string = '';

    constructor(contact) {
      this.name = contact.name;
      this.family = contact.family;
      this.email = contact.email;
      this.street = contact.street;
      this.city = contact.city;
      this.state = contact.state;
      this.zip = contact.zip;
      if (contact.info) this.info = contact.info;
      for (let phone of contact.phones) {
        this.phones.push(new Phone(phone));
      }
    }
}

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  contacts: Contact[] = [];
  filteredContacts: Contact[] = [];
  family: string = '';
  families: string[] = [];
  auth: boolean = false;
  searchTerm: string = '';

  constructor(private data: DataService, private filter: FilterPipe) { }

  ngOnInit() {
    this.data.userContacts.subscribe(contacts => {
      this.contacts = contacts;
      this.filteredContacts = contacts;
      console.log(this.contacts);
      this.getFamilies()
    })

    // this.loadContacts();
    // console.log("contacts", this.contacts);
  }

  getFamilies() {
    for (let contact of this.contacts) {
      if (!this.families.includes(contact.family)) this.families.push(contact.family);
    }
    console.log(this.families);
  }

  loadContacts() {
    // var contactsJson = require('./contacts.json');
    // for (let contact of contactsJson) {
    //   this.data.createUserContact(contact);
    // }
  }

  switchFamily(family: string) {
    this.filteredContacts = this.filter.transform(this.contacts, { family: family });
  }

  filterContacts(event: any) {
    this.filteredContacts = this.filter.transform(this.contacts, { name: event.target.value });
  }

  clearFamily() {
    this.family = '';
  }
}
