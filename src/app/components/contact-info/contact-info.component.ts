import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-contact-info',
  templateUrl: './contact-info.component.html',
  styleUrls: ['./contact-info.component.scss']
})
export class ContactInfoComponent {
  @Input() addresses: any[] = [];
  @Input() phones: any[] = [];
  @Input() emails: any[] = [];
  @Input() compact: boolean = false;

  hasAddresses(): boolean {
    return !!this.addresses && this.addresses.length > 0;
  }

  hasPhones(): boolean {
    return !!this.phones && this.phones.length > 0;
  }

  hasEmails(): boolean {
    return !!this.emails && this.emails.length > 0;
  }

  getUniqueAddresses(): any[] {
    const seen = new Set<string>();
    return (this.addresses || []).filter(addr => {
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

  hasMultipleOwners(items: any[]): boolean {
    if (!items || items.length <= 1) return false;
    const owners = items.map(item => item.owner).filter(o => o);
    return new Set(owners).size > 1;
  }

  hasMultipleUniqueOwners(items: any[]): boolean {
    if (!items || items.length <= 1) return false;
    const owners = items.map(item => item.owner).filter(o => o);
    return new Set(owners).size > 1;
  }
}