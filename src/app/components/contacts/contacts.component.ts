import { Component, OnInit } from '@angular/core';

class Phone {
  number: string;
  type: string;

  constructor(phone) {
    this.number = phone.number;
    this.type = phone.type;
  }
}

class Contact {
    name: string;
    family: string;
    email: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    info: string = '';
    phones: Phone[] = [];

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
  family: string = '';
  families: string[];

  constructor() { }

  ngOnInit() {
    let contactsJson = require('./contacts.json');

    for (let contact of contactsJson) {
      this.contacts.push(new Contact(contact));
    }
    console.log(this.contacts);
  }

  changeFamily(family: string) {
    this.family = family;
  }

  clearFamily() {
    this.family = '';
  }
}
