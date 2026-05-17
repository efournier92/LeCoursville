import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Person, Email, Phone } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';
import { Address } from 'src/app/models/address';
import { PeopleService } from 'src/app/services/people.service';
import { ClanService } from 'src/app/services/clan.service';

export interface ContactCard {
  person: Person;
  spouse: Person | null;
  clan: Clan | null;
  addresses: Address[];
  emails: { address: string; label: string | null; owner: string | null }[];
  phones: { label: string; number: string; owner: string | null }[];
}

@Injectable({
  providedIn: 'root'
})
export class ContactsFromPeopleService {
  private contactsSource: BehaviorSubject<ContactCard[]> = new BehaviorSubject<ContactCard[]>([]);
  contacts$: Observable<ContactCard[]> = this.contactsSource.asObservable();

  constructor(
    private peopleService: PeopleService,
    private clanService: ClanService
  ) {
    this.loadContacts();
  }

  private loadContacts(): void {
    combineLatest([
      this.peopleService.people$,
      this.clanService.clans$
    ]).pipe(
      map(([people, clans]) => this.buildContactCards(people, clans))
    ).subscribe(cards => {
      this.contactsSource.next(cards);
    });
  }

  private buildContactCards(people: Person[], clans: Clan[]): ContactCard[] {
    // Guard against undefined inputs
    if (!people || !clans) {
      return [];
    }

    // Filter out deceased people, but include -S records whose regular spouse is deceased
    const primaryPeople = (people || [])
      .filter(p => {
        if (p.id.endsWith('-S')) {
          // Include -S record only if their regular spouse is deceased (so regular won't show)
          const regularId = p.id.replace('-S', '');
          const regularPerson = (people || []).find(r => r.id === regularId);
          if (!regularPerson || regularPerson.isLiving === false) {
            return p.isLiving !== false && this.hasAnyContactInfo(p, people);
          }
          return false; // Regular spouse is living, they handle display
        }
        return p.isLiving !== false && this.hasAnyContactInfo(p, people);
      })
      .sort((a, b) => {
        if (a.generationNumber !== b.generationNumber) {
          return a.generationNumber - b.generationNumber;
        }
        return a.id.localeCompare(b.id);
      });

    const clanMap = new Map<string, Clan>();
    (clans || []).forEach(c => clanMap.set(c.id, c));

    return primaryPeople.map(person => this.buildContactCard(person, people, clanMap));
  }

  private buildContactCard(
    person: Person,
    allPeople: Person[],
    clanMap: Map<string, Clan>
  ): ContactCard {
    // Resolve spouse
    let spouse: Person | null = null;
    let spouseContactInfo = { emails: [] as Email[], phones: [] as Phone[], addressId: null as string | null };
    if (person.spouseId) {
      spouse = allPeople.find(p => p.id === person.spouseId) || null;
    }
    if (!spouse) {
      // Fallback to -S suffix pattern
      const spouseId = person.id + '-S';
      spouse = allPeople.find(p => p.id === spouseId) || null;
    }

    // Collect spouse contact info before potentially clearing spouse
    let spouseAddresses: Address[] = [];
    if (spouse) {
      spouseContactInfo = {
        emails: spouse.emails || [],
        phones: spouse.phones || [],
        addressId: null
      };
      spouseAddresses = spouse.addresses || [];
    }

    // If spouse is deceased, don't display them but still merge their contact info
    if (spouse && spouse.isLiving === false) {
      spouse = null;
    }

    // Get clan
    const clan = person.clanId ? clanMap.get(person.clanId) || null : null;

    // Collect addresses (embedded in person like emails/phones)
    const addresses: Address[] = [];
    (person.addresses || []).forEach(addr => {
      addresses.push(addr);
    });

    // Collect spouse's addresses (from living spouse)
    (spouseAddresses || []).forEach((addr: Address) => {
      if (!addresses.some(a => a === addr)) {
        addresses.push(addr);
      }
    });

    // Merge emails (deduplicate by address) - include deceased spouse's emails
    const emailMap = new Map<string, { address: string; label: string | null; owner: string | null; count: number }>();
    const personOwnerName = this.getPersonFirstName(person);
    (person.emails || []).forEach(e => {
      if (!emailMap.has(e.address)) {
        emailMap.set(e.address, { address: e.address, label: e.label, owner: personOwnerName, count: 1 });
      } else {
        emailMap.get(e.address)!.count++;
      }
    });
    // Merge spouse emails (from living spouse or deceased spouse contact info)
    if (spouse) {
      const spouseOwnerName = this.getPersonFirstName(spouse);
      (spouse.emails || []).forEach(e => {
        if (!emailMap.has(e.address)) {
          emailMap.set(e.address, { address: e.address, label: e.label, owner: spouseOwnerName, count: 1 });
        } else {
          emailMap.get(e.address)!.count++;
          emailMap.get(e.address)!.owner = null; // shared between spouses, clear owner
        }
      });
    } else {
      // Still merge deceased spouse's emails (label with spouse's stored name)
      const deceasedName = spouseContactInfo.emails.length > 0 ? 'Deceased' : null;
      spouseContactInfo.emails.forEach(e => {
        if (!emailMap.has(e.address)) {
          emailMap.set(e.address, { address: e.address, label: e.label, owner: deceasedName, count: 1 });
        } else {
          emailMap.get(e.address)!.count++;
          emailMap.get(e.address)!.owner = null;
        }
      });
    }
    const emails = Array.from(emailMap.values()).map(({ count, ...rest }) => rest);

    // Merge phones (deduplicate by number) - include deceased spouse's phones
    const phoneMap = new Map<string, { label: string; number: string; owner: string | null; count: number }>();
    (person.phones || []).forEach(p => {
      if (!phoneMap.has(p.number)) {
        phoneMap.set(p.number, { label: p.label, number: p.number, owner: personOwnerName, count: 1 });
      } else {
        phoneMap.get(p.number)!.count++;
      }
    });
    if (spouse) {
      const spouseOwnerName = this.getPersonFirstName(spouse);
      (spouse.phones || []).forEach(p => {
        if (!phoneMap.has(p.number)) {
          phoneMap.set(p.number, { label: p.label, number: p.number, owner: spouseOwnerName, count: 1 });
        } else {
          phoneMap.get(p.number)!.count++;
          phoneMap.get(p.number)!.owner = null;
        }
      });
    } else {
      // Still merge deceased spouse's phones
      const deceasedName = spouseContactInfo.phones.length > 0 ? 'Deceased' : null;
      spouseContactInfo.phones.forEach(p => {
        if (!phoneMap.has(p.number)) {
          phoneMap.set(p.number, { label: p.label, number: p.number, owner: deceasedName, count: 1 });
        } else {
          phoneMap.get(p.number)!.count++;
          phoneMap.get(p.number)!.owner = null;
        }
      });
    }
    const phones = Array.from(phoneMap.values()).map(({ count, ...rest }) => rest);

    return { person, spouse, clan, addresses, emails, phones };
  }

  private hasAnyContactInfo(person: Person, allPeople: Person[]): boolean {
    // Check own emails, phones, addresses
    if ((person.emails || []).length > 0) return true;
    if ((person.phones || []).length > 0) return true;
    if ((person.addresses || []).length > 0) return true;
    // Check if spouse has contact info (since we'll merge spouse's info into the card)
    if (person.spouseId) {
      const spouse = allPeople.find(p => p.id === person.spouseId);
      if (spouse) {
        if ((spouse.emails || []).length > 0) return true;
        if ((spouse.phones || []).length > 0) return true;
        if ((spouse.addresses || []).length > 0) return true;
      }
    }
    // Fallback to -S suffix pattern
    if (!person.spouseId) {
      const spouseId = person.id + '-S';
      const spouse = allPeople.find(p => p.id === spouseId);
      if (spouse) {
        if ((spouse.emails || []).length > 0) return true;
        if ((spouse.phones || []).length > 0) return true;
        if ((spouse.addresses || []).length > 0) return true;
      }
    }
    return false;
  }

  private getPersonFullName(person: Person): string {
    const first = person.name.firstPreferred || person.name.firstGiven || '';
    const last = person.name.last || '';
    return `${first} ${last}`.trim();
  }

  private getPersonFirstName(person: Person): string {
    return person.name.firstPreferred || person.name.firstGiven || '';
  }

  getContacts(): Observable<ContactCard[]> {
    return this.contacts$;
  }
}