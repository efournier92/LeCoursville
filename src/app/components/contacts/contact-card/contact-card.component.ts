import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContactCard } from 'src/app/services/contacts-from-people.service';
import { NameUtilsService } from 'src/app/services/name-utils.service';

@Component({
  selector: 'app-contact-card',
  templateUrl: './contact-card.component.html',
  styleUrls: ['./contact-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactCardComponent implements OnDestroy {
  @Input() contactCard: ContactCard | null = null;
  @Output() personClick = new EventEmitter<string>();
  @Output() spouseClick = new EventEmitter<string>();

  private subscriptions: Subscription[] = [];

  constructor(private nameUtils: NameUtilsService) {}

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getPersonFullName(): string {
    if (!this.contactCard?.person) return '';
    const first = this.contactCard.person.name.firstPreferred || this.contactCard.person.name.firstGiven || '';
    const last = this.contactCard.person.name.last || '';
    return `${first} ${last}`.trim();
  }

  getCoupleFirstNames(): { first: string; second: string } | null {
    if (!this.contactCard?.person) return null;
    const first1 = this.contactCard.person.name.firstPreferred || this.contactCard.person.name.firstGiven || '';
    const last1 = this.contactCard.person.name.last || '';
    if (!this.contactCard.spouse) return null;
    const first2 = this.contactCard.spouse.name.firstPreferred || this.contactCard.spouse.name.firstGiven || '';
    const last2 = this.contactCard.spouse.name.last || '';
    const sameLastName = last1 && last1 === last2;
    return { first: first1, second: sameLastName ? first2 : '' };
  }

  getSharedLastName(): string {
    if (!this.contactCard?.person || !this.contactCard?.spouse) return '';
    const last1 = this.contactCard.person.name.last || '';
    const last2 = this.contactCard.spouse.name.last || '';
    return (last1 && last1 === last2) ? last1 : '';
  }

  hasSameLastName(): boolean {
    if (!this.contactCard?.person || !this.contactCard?.spouse) return false;
    const last1 = this.contactCard.person.name.last || '';
    const last2 = this.contactCard.spouse.name.last || '';
    return last1 !== '' && last1 === last2;
  }

  getCoupleNames(): { first: string; second: string } | null {
    if (!this.contactCard?.person) return null;
    return this.nameUtils.getCoupleNames(this.contactCard.person, this.contactCard.spouse);
  }

  getPersonId(): string {
    return this.contactCard?.person?.id || '';
  }

  getSpouseId(): string {
    return this.contactCard?.spouse?.id || '';
  }

  getClanColor(): string {
    return this.contactCard?.clan?.hexColor || '#cccccc';
  }

  hasEmails(): boolean {
    return !!this.contactCard?.emails && this.contactCard.emails.length > 0;
  }

  hasPhones(): boolean {
    return !!this.contactCard?.phones && this.contactCard.phones.length > 0;
  }

  hasAddresses(): boolean {
    return !!this.contactCard?.addresses && this.contactCard.addresses.length > 0;
  }

  getUniqueAddresses(): any[] {
    if (!this.contactCard?.addresses) return [];
    const seen = new Set<string>();
    return this.contactCard.addresses.filter(addr => {
      const key = this.formatAddress(addr);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  formatAddress(address: any): string {
    if (!address) return '';
    const line1 = address.street || '';
    const cityState = [address.city, address.state].filter(p => p).join(', ');
    const zip = address.zip || '';
    const line2 = zip ? `${cityState} ${zip}` : cityState;
    const parts = [line1, line2].filter(p => p);
    return parts.join('\n');
  }

  onPersonNameClick(): void {
    if (this.contactCard?.person?.id) {
      this.personClick.emit(this.contactCard.person.id);
    }
  }

  onSpouseNameClick(): void {
    if (this.contactCard?.spouse?.id) {
      this.spouseClick.emit(this.contactCard.spouse.id);
    }
  }

  hasConflictingLabels(item: any, type: 'email' | 'phone'): boolean {
    if (!this.contactCard) return false;
    const items = type === 'email' ? this.contactCard.emails : this.contactCard.phones;
    if (items.length <= 1) return false;
    const firstLabel = items[0]?.label || null;
    return !items.some(item => (item.label || null) !== firstLabel);
  }
}