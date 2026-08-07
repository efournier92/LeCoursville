import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Contact } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  userId: string;
  user: User;

  private contactsSource: BehaviorSubject<any[]> = new BehaviorSubject([]);
  userContacts: Observable<any[]> = this.contactsSource.asObservable();

  constructor(
    private rtdb: RtdbService,
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        if (!user?.id) { return; }
        this.getContacts().valueChanges().subscribe(
          (contacts: Contact[]) => {
            this.updateContactsEvent(contacts);
          }
        );
      }
    );
  }

  updateContactsEvent(contacts: Contact[]): void {
    this.contactsSource.next(contacts);
  }

  getContacts() {
    if (!this.user) {
      return undefined;
    }

    return this.rtdb.list<Contact>(`contacts`);
  }

  newContact(contact: Contact): void {
    contact.id = this.rtdb.createPushId();
    this.rtdb.object(`contacts/${contact.id}`).set(contact);
  }

  updateContact(contact: Contact): void {
    if (!contact.id) {
      contact.id = this.rtdb.createPushId();
    }

    this.rtdb.object(`contacts/${contact.id}`).update(contact as any);
  }

  deleteContact(contact: Contact): void {
    this.rtdb.object(`contacts/${contact.id}`).remove();
  }
}
