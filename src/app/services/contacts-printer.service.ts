import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { Contact, Address, Phone, Email } from '../models/contact';
import * as openSansLight from 'src/assets/fonts/OpenSans-Light-normal.js';
import * as openSansRegular from 'src/assets/fonts/OpenSans-Regular-normal.js';
import * as openSansBold from 'src/assets/fonts/OpenSans-Bold-bold.js';

class ContactsPrintConfig {
  lineHeight: number;
  currentLine: number;
  positionLeft: number;
  currentColumn: string;
  currentIndex: number;
  leftLine: number;
  lastStartLine: any;
  spaceBetweenContacts: number;
  maxLinesPerPage: number;
  rightColumnDistanceFromLeft: number;
  leftColumnDistanceFromLeft: number;
  startingDistanceFromTop: number;
  leftColumnName: string;
  rightColumnName: string;

  public constructor() {
    this.currentLine = 0;
    this.leftColumnName = 'left';
    this.rightColumnName = 'right';
    this.currentColumn = this.leftColumnName;
    this.lineHeight = 22;
    this.positionLeft = 60;
    this.leftLine = 0;
    this.currentIndex = 0;
    this.lastStartLine = 0;
    this.startingDistanceFromTop = 80;
    this.spaceBetweenContacts = 25;
    this.maxLinesPerPage = 600;
    this.rightColumnDistanceFromLeft = 350;
    this.leftColumnDistanceFromLeft = 60;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ContactsPrinterService {
  private pdf: jsPDF = new jsPDF('p', 'pt', 'letter');
  private totalContacts: number;
  private contactsToPrint: Contact[];
  private printConfig: ContactsPrintConfig = this.getPrintConfig();

  constructor() { }

  public downloadPdf(contacts: Contact[]) {
    this.prepareToPrint(contacts);
    this.pdf.save('LeCoursville_Directory.pdf');
  }

  public printPdf(contacts: Contact[]) {
    this.prepareToPrint(contacts);
    this.pdf.autoPrint();
    window.open(this.pdf.output('bloburl').toString());
  }

  private getPrintConfig() {
    return new ContactsPrintConfig();
  }

  private prepareToPrint(contacts: Contact[]) {
    this.printConfig = this.getPrintConfig();

    this.printConfig.currentLine = this.printConfig.startingDistanceFromTop;
    this.printConfig.currentColumn = this.printConfig.leftColumnName;

    this.totalContacts = contacts.length;
    this.contactsToPrint = contacts;

    this.pdf.setFontSize(12);

    this.prepareFonts();

    this.renderAllContactsToPage();
  }

  private renderAllContactsToPage() {
    for (const contact of this.contactsToPrint) {
      this.renderContactToPage(contact);
    }
  }

  private prepareFonts() {
    this.pdf.getFontList();
  }

  private setFontForHeader() {
    this.setFontWeightToBold();
    this.setFontSizeToLarge();
  }

  private setFontForBody() {
    this.setFontWeightToRegular();
    this.setFontSizeToRegular();
  }

  private setFontWeightToBold() {
    this.pdf.setFont('OpenSans-Bold', 'bold');
  }

  private setFontWeightToRegular() {
    this.pdf.setFont('OpenSans-Regular', 'normal');
  }

  private setFontSizeToLarge() {
    this.pdf.setFontSize(14);
  }

  private setFontSizeToRegular() {
    this.pdf.setFontSize(12);
  }

  private setFontSizeToSmall() {
    this.pdf.setFontSize(10);
  }

  private renderContactToPage(contact: Contact) {
    this.printConfig.lastStartLine = this.printConfig.currentLine;

    this.setFontForHeader();

    this.pdf.text(contact.name, this.printConfig.positionLeft, this.printConfig.currentLine);

    this.setFontForBody();

    this.printConfig.currentLine += this.printConfig.lineHeight;

    if (contact.addresses) {
      this.renderAddressToPage(contact.addresses);
    }

    this.setFontSizeToSmall();

    if (contact.phones) {
      this.renderUserPhones(contact.phones);
    }

    if (contact.emails) {
      this.printUserEmails(contact.emails);
    }

    this.setFontSizeToRegular();

    this.prepareToPrintNextContact();
  }

  private renderAddressToPage(addresses: Address[]) {
    for (const address of addresses) {
      this.pdf.text(address.street, this.printConfig.positionLeft, this.printConfig.currentLine);
      this.printConfig.currentLine += this.printConfig.lineHeight;
      this.pdf.text(`${address.city}, ${address.state}, ${address.zip}`, this.printConfig.positionLeft, this.printConfig.currentLine);
      this.printConfig.currentLine += this.printConfig.lineHeight;
    }
  }

  private renderUserPhones(phones: Phone[]) {
    for (const phone of phones) {
      if (!phone || !phone.number) {
        continue;
      }

      const startingPositionLeft = this.printConfig.positionLeft;

      this.printUserEmailInfo(phone.info, 'Phone:');

      this.setFontWeightToRegular();

      this.pdf.text(phone.number, this.printConfig.positionLeft + 60, this.printConfig.currentLine);
      this.printConfig.currentLine += this.printConfig.lineHeight;

      this.printConfig.positionLeft = startingPositionLeft;

      // this.setFontSizeToRegular();
    }
  }

  private printUserEmails(emails: Email[]) {
    for (const email of emails) {
      if (!email || !email.address) {
        continue;
      }

      const startingPositionLeft = this.printConfig.positionLeft;

      this.printUserEmailInfo(email.info, 'Email:');

      this.setFontWeightToRegular();

      this.pdf.text(email.address, this.printConfig.positionLeft + 60, this.printConfig.currentLine);
      this.printConfig.currentLine += this.printConfig.lineHeight;

      this.printConfig.positionLeft = startingPositionLeft;
    }
  }

  private printUserEmailInfo(info: string, defaultTag: string) {
    const pixelsPerCharacter = 7.5;
    this.setFontWeightToBold();

    const emailIInfo = (info && info !== '')
      ? `${info}:`
      : defaultTag;

    this.pdf.text(emailIInfo, this.printConfig.positionLeft, this.printConfig.currentLine);
    // this.printConfig.positionLeft += (pixelsPerCharacter * emailIInfo.length);
    this.setFontWeightToRegular();
  }

  private prepareToPrintNextContact() {
    this.printConfig.currentIndex++;

    if (this.printConfig.currentColumn === this.printConfig.leftColumnName) {
      this.prepareToPrintInRightColumn();
    } else {
      this.prepareToPrintInLeftColumn();
    }

    if (this.shouldStartNewPage()) {
      this.startNewPage();
    }
  }

  private prepareToPrintInRightColumn() {
    this.printConfig.currentColumn = this.printConfig.rightColumnName;
    this.printConfig.leftLine = this.printConfig.currentLine;
    this.printConfig.currentLine = this.printConfig.lastStartLine;
    this.printConfig.positionLeft = this.printConfig.rightColumnDistanceFromLeft;
  }

  private prepareToPrintInLeftColumn() {
    this.printConfig.currentColumn = this.printConfig.leftColumnName;
    if (this.printConfig.leftLine && this.printConfig.leftLine > this.printConfig.currentLine) {
      this.printConfig.currentLine = this.printConfig.leftLine;
    }
    this.printConfig.positionLeft = this.printConfig.leftColumnDistanceFromLeft;
    this.printConfig.currentLine += this.printConfig.spaceBetweenContacts;
  }

  private shouldStartNewPage() {
    return (this.printConfig.currentLine >= this.printConfig.maxLinesPerPage && this.printConfig.currentIndex !== this.totalContacts);
  }

  private startNewPage() {
    this.pdf.addPage();
    this.printConfig.currentLine = this.printConfig.startingDistanceFromTop;
  }
}
