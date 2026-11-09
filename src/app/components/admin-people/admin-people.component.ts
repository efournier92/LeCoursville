import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { PeopleService } from 'src/app/services/people.service';
import { FamilyService } from 'src/app/services/family.service';
import { Family } from 'src/app/models/family';
import { Person, PersonDate } from 'src/app/models/person';
import { paginate, Page, pageRange } from 'src/app/admin/pagination';

type PeopleSortKey = 'name' | 'family' | 'generation' | 'born' | 'updated';
type PeopleState = 'loading' | 'ready' | 'error';

interface PeopleSortOption {
  key: PeopleSortKey;
  label: string;
}

@Component({
    selector: 'app-admin-people',
    templateUrl: './admin-people.component.html',
    styleUrls: ['./admin-people.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminPeopleComponent implements OnInit, OnDestroy {
  view: 'people' | 'import' = 'people';
  state: PeopleState = 'loading';
  loadError = '';
  filterQuery = '';
  sortKey: PeopleSortKey = 'name';
  sortAscending = true;
  pageIndex = 1;
  filteredTotal = 0;
  displayedPeople: Person[] = [];
  filteredPeople: Person[] = [];
  selectedPersonId: string | null = null;
  readonly pageSize = 10;
  readonly sortOptions: PeopleSortOption[] = [
    { key: 'name', label: 'Name' },
    { key: 'family', label: 'Family' },
    { key: 'generation', label: 'Generation' },
    { key: 'born', label: 'Born' },
    { key: 'updated', label: 'Updated' },
  ];

  private allPeople: Person[] = [];
  private familiesById = new Map<string, Family>();
  private displayedPage: Page<Person> = { items: [], total: 0, page: 1, pageCount: 1, pageSize: 10 };
  private peopleSub?: Subscription;
  private familySub?: Subscription;
  private errorSub?: Subscription;

  constructor(
    private peopleService: PeopleService,
    private familyService: FamilyService,
  ) {}

  ngOnInit(): void {
    this.familySub = this.familyService.families$.subscribe(families => {
      this.familiesById = new Map((families || []).map(family => [family.id, family]));
      this.refreshPeople();
    });
    this.errorSub = this.peopleService.loadError$.subscribe(message => {
      if (message) {
        this.loadError = message;
        this.state = 'error';
      }
    });
    this.peopleSub = combineLatest([
      this.peopleService.people$,
      this.peopleService.peopleLoaded$,
    ]).subscribe(([people, loaded]) => {
      this.allPeople = people || [];
      if (loaded) {
        this.state = 'ready';
        this.loadError = '';
      }
      this.refreshPeople();
    });
  }

  ngOnDestroy(): void {
    this.peopleSub?.unsubscribe();
    this.familySub?.unsubscribe();
    this.errorSub?.unsubscribe();
  }

  setView(view: 'people' | 'import'): void {
    this.view = view;
  }

  retry(): void {
    this.state = 'loading';
    this.loadError = '';
    this.peopleService.retryPeople();
  }

  onFilterQueryChange(query: string): void {
    this.filterQuery = query;
    this.pageIndex = 1;
    this.refreshPeople();
  }

  setSort(key: PeopleSortKey): void {
    if (this.sortKey === key) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortKey = key;
      this.sortAscending = true;
    }
    this.pageIndex = 1;
    this.refreshPeople();
  }

  reverseSort(): void {
    this.sortAscending = !this.sortAscending;
    this.refreshPeople();
  }

  previousPage(): void {
    this.pageIndex = Math.max(1, this.pageIndex - 1);
    this.refreshPeople();
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.pageCount, this.pageIndex + 1);
    this.refreshPeople();
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredTotal / this.pageSize));
  }

  get showingRange(): string {
    return pageRange(this.displayedPage);
  }

  get sortLabel(): string {
    return this.sortOptions.find(option => option.key === this.sortKey)?.label || 'Name';
  }

  isActiveSort(key: PeopleSortKey): boolean {
    return this.sortKey === key;
  }

  openPerson(person: Person): void {
    this.selectedPersonId = person.id;
  }

  openPersonById(id: string): void {
    this.selectedPersonId = id;
  }

  closePerson(): void {
    this.selectedPersonId = null;
  }

  personName(person: Person): string {
    const name = person?.name;
    if (!name) {
      return '—';
    }
    const parts = [
      name.firstPreferred || name.firstGiven,
      name.maiden ? `(${name.maiden})` : null,
      name.last,
      name.suffix,
    ].filter(Boolean);
    return parts.join(' ') || '—';
  }

  personFamily(person: Person): string {
    if (!person?.familyId) {
      return '—';
    }
    return this.familiesById.get(person.familyId)?.name || '—';
  }

  personBorn(person: Person): string {
    return person?.birthday?.year ? String(person.birthday.year) : '—';
  }

  personBornFull(person: Person): string {
    return this.formatDate(person?.birthday);
  }

  personDied(person: Person): string {
    return person?.deathDate?.year ? String(person.deathDate.year) : '—';
  }

  personDiedFull(person: Person): string {
    return this.formatDate(person?.deathDate);
  }

  personAnniversary(person: Person): string {
    return person?.anniversaryDate?.year ? String(person.anniversaryDate.year) : '—';
  }

  personAnniversaryFull(person: Person): string {
    return this.formatDate(person?.anniversaryDate);
  }

  personSpouse(person: Person): string {
    return person?.spouseId || '—';
  }

  personContact(person: Person): string {
    return person?.emails?.[0]?.address || person?.phones?.[0]?.number || '—';
  }

  personAddress(person: Person): string {
    const address = (person?.addresses || [])[0];
    if (!address) {
      return '—';
    }
    return [address.city, address.state].filter(Boolean).join(', ') || address.full || '—';
  }

  personLiving(person: Person): string {
    return person?.isLiving === false ? 'Deceased' : 'Living';
  }

  personUpdated(person: Person): string {
    return person?.updatedAt ? new Date(person.updatedAt).toISOString().slice(0, 10) : '—';
  }

  private formatDate(date: PersonDate | null | undefined): string {
    if (!date?.year) {
      return '—';
    }
    const month = String(date.month || 1).padStart(2, '0');
    const day = String(date.day || 1).padStart(2, '0');
    return `${date.year}-${month}-${day}`;
  }

  private refreshPeople(): void {
    const query = this.filterQuery.trim().toLowerCase();
    const filtered = query
      ? this.allPeople.filter(person => this.searchText(person).includes(query))
      : [...this.allPeople];
    filtered.sort((a, b) => {
      const order = this.comparePeople(a, b);
      return this.sortAscending ? order : -order;
    });
    const page = paginate(filtered, this.pageIndex, this.pageSize);
    this.displayedPage = page;
    this.pageIndex = page.page;
    this.filteredTotal = page.total;
    this.filteredPeople = filtered;
    this.displayedPeople = page.items;
  }

  private searchText(person: Person): string {
    const names = [
      this.personName(person),
      person?.name?.firstGiven,
      person?.name?.firstPreferred,
      person?.name?.maiden,
      person?.name?.last,
      this.personFamily(person),
    ];
    const contacts = [
      ...(person?.emails || []).map(email => email.address),
      ...(person?.phones || []).map(phone => phone.number),
    ];
    const address = (person?.addresses || []).flatMap(item =>
      [item.street, item.city, item.state, item.zip, item.full]);
    return [...names, ...contacts, ...address].filter(Boolean).join(' ').toLowerCase();
  }

  private comparePeople(a: Person, b: Person): number {
    switch (this.sortKey) {
      case 'family':
        return this.personFamily(a).localeCompare(this.personFamily(b));
      case 'generation':
        return (a?.generationNumber || 0) - (b?.generationNumber || 0);
      case 'born':
        return (a?.birthday?.year || 0) - (b?.birthday?.year || 0);
      case 'updated':
        return (a?.updatedAt || 0) - (b?.updatedAt || 0);
      case 'name':
      default:
        return this.personName(a).localeCompare(this.personName(b));
    }
  }
}
