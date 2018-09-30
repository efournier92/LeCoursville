import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { Contact } from './contact';
import { BehaviorSubject } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  contacts: AngularFireList<Contact>;
  userId: String;

  constructor(
    private db: AngularFireDatabase,
    private auth: AngularFireAuth,
  ) {
    this.auth.authState.subscribe(
      user => {
      if (!user || !user.uid) return;
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
    // if (!userId) return;
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
}
