import { Component, OnInit, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { FilterPipe } from 'ngx-filter-pipe';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import { Contact } from 'src/app/components/contacts/contact';
import { ContactsService } from './contacts.service';
import print from 'print-js'
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import pdfMake from "pdfmake/build/pdfmake";

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  contacts: Contact[] = [];
  filteredContacts: Contact[] = [];
  family: string = '';
  families: string[] = [];
  searchTerm: string = '';
  user: User;
  printJS = print;
  @ViewChild("contactCards") el:ElementRef;

  constructor(
    private data: ContactsService, 
    private filter: FilterPipe,
    private auth: AuthService,
    private rd: Renderer2,
  ) { }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      });

    this.data.userContacts.subscribe(contacts => {
      this.contacts = contacts;
      this.filteredContacts = contacts;
      console.log(this.contacts);
      this.getFamilies();
    })

    // this.loadContacts();
    // console.log("contacts", this.contacts);
  }

  printPage() {
    console.log('hit');
    // printJs('contact-cards-container', 'html');
  }

  getFamilies() {
    for (let contact of this.contacts) {
      if (!this.families.includes(contact.family)) this.families.push(contact.family);
    }
    console.log(this.families);
  }

  loadContacts() {
    // var contactsJson = require('./contacts.json');
    // for (let contact of contactsJson) {
    //   this.data.createUserContact(contact);
    // }
  }

  switchFamily(family: string) {
    this.filteredContacts = this.filter.transform(this.contacts, { family: family });
  }

  filterContacts(event: any) {
    this.filteredContacts = this.filter.transform(this.contacts, { name: event.target.value });
  }

  clearFamily() {
    this.family = '';
  }

  printPdf() {
    html2canvas(document.getElementById('contact-cards-container')).then(
      canvas => {
          canvas.toDataURL().then(
            data => {
              var docDefinition = {
                content: [{
                    image: data,
                    width: 500,
                }]
            };
            pdfMake.createPdf(docDefinition).download("Score_Details.pdf");
          });
         
      }
  );
    // console.log(document.getElementById('contact-cards-container'))
    // let pdf = new jsPDF();
    //   pdf.fromHTML(document.getElementById('contact-cards-container'), {
    //     'width': 170, 
    //     // 'elementHandlers': specialElemen tHandlers
    //   });
      
    //   pdf.text()
  }

}
