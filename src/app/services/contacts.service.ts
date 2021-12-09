import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Contact } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import jsPDF from 'jspdf';
import { ContactsPrinterService } from './contacts-printer.service';

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
    private printer: ContactsPrinterService,
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
      }
    );
  }

  private contactsSource: BehaviorSubject<any[]> = new BehaviorSubject([]);
  userContacts: Observable<any[]> = this.contactsSource.asObservable();

  updateContactsEvent(contacts: Contact[]): void {
    this.contactsSource.next(contacts);
  }

  getContacts(): AngularFireList<Contact> {
    if (!this.user)
      return undefined;
      
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
}
