import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { Contact } from './contact';
import { BehaviorSubject, Observable } from 'rxjs';
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
          (contacts: Contact[]) => {
            this.updateContactsEvent(contacts);
          }
        );
      });
  }

  private contactsSource: BehaviorSubject<any[]> = new BehaviorSubject([]);
  userContacts: Observable<any[]> = this.contactsSource.asObservable();
  updateContactsEvent(contacts: Contact[]): void {
    this.contactsSource.next(contacts);
  }

  getContacts(): AngularFireList<Contact> {
    if (!this.user) return;
    this.contacts = this.db.list(`contacts`);
    return this.contacts;
  }

  newContact(contact: Contact): void {
    contact.id = this.db.createPushId();
    this.contacts.set(contact.id, contact);
  }

  updateContact(contact: Contact): void {
    this.contacts.update(contact.id, contact);
  }

  deleteContact(contact: Contact): void {
    this.contacts.remove(contact.id);
  }

  printPdf(contacts: Contact[], method: string): void {
    const totalContacts: number = contacts.length;
    let pdf: jsPDF = new jsPDF('p', 'pt', 'letter');

    const lineHeight: number = 22;
    let line: number = 80;
    let left: number = 60;
    let leftLine;
    let onPage: number = 0;
    pdf.setFontSize(12);

    let i: number = 0;
    let side: string = 'left';
    for (let contact of contacts) {
      let lastStartLine: number = line;
      pdf.setFontSize(14);
      pdf.setFontType('bold');
      pdf.text(left, line, contact.name);
      pdf.setFontType('normal');
      pdf.setFontSize(12);
      line += lineHeight;

      if (contact.addresses) {
        for (let address of contact.addresses) {
          pdf.text(left, line, address.street);
          line += lineHeight;
          pdf.text(left, line, `${address.city}, ${address.state}, ${address.zip}`);
          line += lineHeight;
        }
      }

      if (contact.phones) {
        for (let phone of contact.phones) {
          if (!phone || !phone.number)
            continue;
          let phoneString: string = '';
          if (phone.info && phone.info !== '')
            phoneString += `${phone.info}: `;
          phoneString += phone.number;
          pdf.text(left, line, phoneString);
          line += lineHeight;
        }
      }

      if (contact.emails) {
        for (let email of contact.emails) {
          if (!email || !email.address)
            continue;
          let emailString: string = '';
          if (email.info && email.info !== '')
            emailString += `${email.info}: `;
          emailString += email.address;
          pdf.text(left, line, emailString);
          line += lineHeight;
        }
      }
      i++;
      if (side === 'left') {
        side = 'right';
        leftLine = line;
        line = lastStartLine;
        left = 350;
      } else {
        side = 'left';
        if (leftLine && leftLine > line)
          line = leftLine;
        left = 60;
        line += 50;
        onPage += 1;
      }

      if (line >= 600 && i !== totalContacts) {
        pdf.addPage();
        onPage = 0;
        line = 80;
      }
    }

    if (method === 'print') {
      pdf.autoPrint();
      window.open(pdf.output('bloburl'));
    } else if (method === 'download') {
      pdf.save('LeCoursville_Directory.pdf');
    }
  }
}
