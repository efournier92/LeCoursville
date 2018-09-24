import { Component, OnInit } from '@angular/core';
import { DataService } from '../../services/data.service'

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

  constructor(private data: DataService) { }

  ngOnInit() {
    this.data.userContacts.subscribe(contacts => {
      this.contacts = contacts;
      console.log(this.contacts);
    })

    // this.loadContacts();
    // console.log("contacts", this.contacts);
  }

  loadContacts() {
    // var contactsJson = require('./contacts.json');
    // for (let contact of contactsJson) {
    //   this.data.createUserContact(contact);
    // }
  }

  changeFamily(family: string) {
    this.family = family;
  }

  clearFamily() {
    this.family = '';
  }
}
