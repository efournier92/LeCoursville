import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContactCard } from 'src/app/services/contacts-from-people.service';

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

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getPersonFullName(): string {
    if (!this.contactCard?.person) return '';
    const first = this.contactCard.person.name.firstPreferred || this.contactCard.person.name.firstGiven || '';
    const last = this.contactCard.person.name.last || '';
    return `${first} ${last}`.trim();
  }

  getSpouseFullName(): string {
    if (!this.contactCard?.spouse) return '';
    const first = this.contactCard.spouse.name.firstPreferred || this.contactCard.spouse.name.firstGiven || '';
    const last = this.contactCard.spouse.name.last || '';
    return `${first} ${last}`.trim();
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
    // If labels are all the same, no conflict - owner prefix not needed to distinguish
    const firstLabel = items[0]?.label || null;
    return !items.some(item => (item.label || null) !== firstLabel);
  }
}