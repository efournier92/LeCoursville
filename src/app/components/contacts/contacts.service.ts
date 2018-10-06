import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { Contact, Phone, Email, Address } from './contact';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import jsPDF from 'jspdf';

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  contacts: AngularFireList<Contact>;
  userId: String;
  user: User;

  constructor(
    private db: AngularFireDatabase,
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        if (!user || !user.id) return;
        this.getContacts().valueChanges().subscribe(
          contacts => {
            this.updateContactsEvent(contacts);
          }
        );
      });
  }
  private contactsSource = new BehaviorSubject([]);
  userContacts = this.contactsSource.asObservable();

  updateContactsEvent(contacts: Contact[]) {
    this.contactsSource.next(contacts);
  }

  changeAddresses(contacts) {
    for (let contact of contacts) {
      let address = new Address();
      address.city = contact.city;
      address.state = contact.state;
      address.street = contact.street;
      address.zip = contact.zip;
      address.info = '';
      contact.addresses = new Array<Address>();
      contact.addresses.push(address);
      this.updateContact(contact);
    }
  }

  changeEmails(contacts) {
    for (let contact of contacts) {
      let email = contact.email[0][0][0];
      contact.emails = [];
      contact.emails.push(email);
      this.updateContact(contact);
    }
  }

  changePhones(contacts) {
    for (let contact of contacts) {
      // if (contact.email === undefined) {
      //   console.log(contact);
      // }

      if (contact && contact.email && contact.email[0] && contact.email[0][0] && contact.email[0][0][0]) {
        let oldEmail = contact.email[0][0][0];
        contact.emails = new Array<Email>();
      let email = new Email();
      email.address = oldEmail;
      email.info = '';
      contact.emails.push(email);
      email = new Email();
      email.address = '';
      email.info = '';
      contact.emails.push(email);
      this.updateContact(contact);
      }
    }
  }

  getContacts(): AngularFireList<Contact> {
    if (!this.user) return;
    this.contacts = this.db.list(`contacts`);
    return this.contacts;
  }

  newContact(contact: Contact) {
    contact.id = this.db.createPushId();
    this.contacts.set(contact.id, contact);
  }

  updateContact(contact: Contact) {
    this.contacts.update(contact.id, contact);
  }

  deleteContact(contact: Contact) {
    this.contacts.remove(contact.id);
  }

  printPdf(contacts: Contact[], method: string) {
    let pdf = new jsPDF('p', 'pt', 'letter');

    pdf.setFontSize(12);
    let line = 70;
    let lineHeight = 22;
    let onPage = 0;

    function buildPhoneString(contact) {
      let phoneString = '';
      for (let phone of contact.phones) {
        phone.type = phone.type.charAt(0).toUpperCase() + phone.type.substr(1);
        if (phone.type !== '') {
          phoneString += `${phone.type}: `;
        }
        phoneString += phone.number;
        phoneString += '  ';
      }
      return phoneString;
    }

    function buildEmailString(contact) {
      let emailString = '';
      for (let email of contact.emails) {
        if (email.info !== '') {
          emailString += `${email.info}: `;
        }
        emailString += `${email.address}   `;
      }
      return emailString;
    }

    for (let contact of contacts) {
      if (contact.phones) buildPhoneString(contact)

      let phoneString = buildPhoneString(contact);
      let emailString = buildEmailString(contact);

      pdf.setFontSize(14);
      pdf.setFontType("bold");
      pdf.text(60, line, contact.name);
      pdf.setFontType("normal");
      pdf.setFontSize(12);
      line += lineHeight;

      pdf.text(60, line, contact.street);
      line += lineHeight;
      pdf.text(60, line, `${contact.city}, ${contact.state}, ${contact.zip}`);

      if (phoneString !== '') {
        line += lineHeight;
        pdf.text(60, line, `${phoneString}`);
      }
      line += 50;
      pdf.text(60, line, `${emailString}`);

      onPage += 1;
      line += 50;
      if (onPage === 6 && contacts.length) {
        pdf.addPage();
        onPage = 0;
        line = 70;
      }

    }

    if (method === 'print') {
      window.open(pdf.output('bloburl'), '_blank');
    } else if (method === 'download') {
      pdf.save('LeCoursville_Directory.pdf');
    }

  }
}
