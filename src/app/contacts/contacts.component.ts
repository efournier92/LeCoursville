import { Component, OnInit } from '@angular/core';
import { FilterPipe } from 'ngx-filter-pipe';
import { Contact } from 'src/app/contacts/contact';
import { families } from 'src/app/contacts/families';
import { AuthService } from 'src/app/auth/auth.service';
import { ContactsService } from 'src/app/contacts/contacts.service';
import { User } from 'src/app/auth/user';
import { ConfirmPromptService } from '../confirm-prompt/confirm-prompt.service';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  user: User;
  contacts: Contact[] = [];
  searchTerm: string = '';
  filteredContacts: Contact[] = [];
  family: string = '';
  families: string[] = families;

  constructor(
    private contactsService: ContactsService,
    private filter: FilterPipe,
    private auth: AuthService,
    private confirmPrompt: ConfirmPromptService,
  ) { }

  ngOnInit(): void {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      });

    this.contactsService.userContacts.subscribe(contacts => {
      this.contacts = contacts;
      this.filteredContacts = contacts.sort((a, b) => a.name > b.name ? 1 : -1);
    })
  }

  switchFamily(family: string): void {
    this.filteredContacts = this.filter.transform(this.contacts, { family: family });
  }

  newContact(): void {
    const dialogRef = this.confirmPrompt.openDialog(
      "Are You Sure?",
      "Do you want to add this contact to LeCoursville?",
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          let contact: Contact = new Contact();
          this.contactsService.newContact(contact);
        }
      }
    )
  }

  filterContacts(event: any): void {
    this.filteredContacts = this.filter.transform(this.contacts, { name: event.target.value });
  }

  clearFamily(): void {
    this.family = '';
  }

  printPdf(): void {
    this.contactsService.printPdf(this.filteredContacts, 'print');
  }

  downloadPdf(): void {
    this.contactsService.printPdf(this.filteredContacts, 'download');
  }
}
