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
    const totalContacts = contacts.length;
    let pdf = new jsPDF('p', 'pt', 'letter');

    const lineHeight = 22;
    let line = 80;
    let onPage = 0;
    pdf.setFontSize(12);

    let i = 0;
    for (let contact of contacts) {
      pdf.setFontSize(14);
      pdf.setFontType("bold");
      pdf.text(60, line, contact.name);
      pdf.setFontType("normal");
      pdf.setFontSize(12);
      line += lineHeight;

      if (contact.addresses) {
        for (let address of contact.addresses) {
          pdf.text(60, line, address.street);
          line += lineHeight;
          pdf.text(60, line, `${address.city}, ${address.state}, ${address.zip}`);
          line += lineHeight;
        }
      }

      if (contact.phones) {
        for (let phone of contact.phones) {
          if (!phone || !phone.number)
            continue;
          let phoneString = '';
          if (phone.info && phone.info !== '')
            phoneString += `${phone.info}: `;
          phoneString += phone.number;
          pdf.text(60, line, phoneString);
          line += lineHeight;
        }
      }

      if (contact.emails) {
        for (let email of contact.emails) {
          if (!email || !email.address)
            continue;
          let emailString = '';
          if (email.info && email.info !== '')
            emailString += `${email.info}: `;
          emailString += email.address;
          pdf.text(60, line, emailString);
          line += lineHeight;
        }
      }
      i++;
      line += 50;
      onPage += 1;
      if (line >= 600 && i !== totalContacts) {
        pdf.addPage();
        onPage = 0;
        line = 80;
      }
    }
    
    if (method === 'print') {
      window.open(pdf.output('bloburl'), '_blank');
    } else if (method === 'download') {
      pdf.save('LeCoursville_Directory.pdf');
    }
  }
}
