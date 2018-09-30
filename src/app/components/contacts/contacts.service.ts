import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { Contact } from './contact';
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

  getContacts(): AngularFireList<Contact> {
    if (!this.user) return;
    this.contacts = this.db.list(`contacts`);
    return this.contacts;
  }

  createUserContact(contact: Contact) {
    contact.id = this.db.createPushId();
    this.contacts.set(contact.id, contact);
  }

  updateUserContact(contact: Contact) {
    this.contacts.update(contact.id, contact);
  }

  deleteUserContact(contact: Contact) {
    this.contacts.remove(contact.id);
  }

  printPdf(contacts: Contact[], method: string) {
    let pdf = new jsPDF('p', 'pt', 'letter');

    pdf.setFontSize(12);
    let line = 70;
    let lineHeight = 22;
    let onPage = 0;

    for (let contact of contacts) {
      let phoneString = '';
      if (contact.phones) {
        for (let phone of contact.phones) {
          phone.type = phone.type.charAt(0).toUpperCase() + phone.type.substr(1);
          if (phone.type !== '') {
            phoneString += `${phone.type}: `;
          }
          phoneString += phone.number;
          phoneString += '  ';
        }
      }

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

      onPage += 1;
      line += 50;
      if (onPage === 6 && contacts.length ) {
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
