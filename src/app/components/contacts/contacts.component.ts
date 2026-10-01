import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { ContactCard } from "src/app/services/contacts-from-people.service";
import { ContactsFromPeopleService } from "src/app/services/contacts-from-people.service";
import { AnalyticsService } from "src/app/services/analytics.service";
import { ClanService } from "src/app/services/clan.service";
import { Clan } from "src/app/models/clan";

@Component({
    selector: "app-contacts",
    templateUrl: "./contacts.component.html",
    styleUrls: ["./contacts.component.scss"],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ContactsComponent implements OnInit, OnDestroy {
  contacts: ContactCard[] = [];
  searchTerm = "";
  selectedClan = '';
  clans: Clan[] = [];
  selectedPersonId: string | null = null;
  skeletonIterations = [1, 2, 3, 4, 5, 6];
  status: 'loading' | 'error' | 'ready' = 'loading';

  private contactsSub: Subscription | null = null;
  private clansSub: Subscription | null = null;
  private contactsArrived = false;
  private clansArrived = false;

  constructor(
    private contactsFromPeopleService: ContactsFromPeopleService,
    private clanService: ClanService,
    private analyticsService: AnalyticsService,
    public router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subscribeData();

    this.route.queryParamMap.subscribe(queryParams => {
      this.searchTerm = queryParams.get('filter') || '';
      this.selectedClan = queryParams.get('clan') || '';
      this.selectedPersonId = queryParams.get('selected') || null;
      // Re-trigger filter after query params update
      this.contactsFromPeopleService.contacts$.subscribe(cards => {
        this.applyFilters(cards);
      }, () => (this.status = 'error')).add(() => {});
    }, () => (this.status = 'error'));

    this.analyticsService.logEvent("component_load_contacts", {});
  }

  ngOnDestroy(): void {
    this.contactsSub?.unsubscribe();
    this.clansSub?.unsubscribe();
  }

  retry(): void {
    this.subscribeData();
  }

  // The services seed BehaviorSubjects with [], so a synchronous replay of an
  // empty list is still the seed, not data.
  // minimalist: a warm route into a genuinely empty dataset waits for the next
  // fresh emit; expose a loaded$ on the services if that ever matters.
  private subscribeData(): void {
    this.status = 'loading';
    this.contactsArrived = false;
    this.clansArrived = false;
    this.clansSub?.unsubscribe();
    this.contactsSub?.unsubscribe();

    let clansSeed = true;
    this.clansSub = this.clanService.clans$.subscribe(clans => {
      const seedEmpty = clansSeed && clans.length === 0;
      clansSeed = false;
      this.clans = clans.sort((a, b) => (a.sortOrder || a.name).localeCompare(b.sortOrder || b.name));
      if (!seedEmpty) {
        this.clansArrived = true;
        this.updateStatus();
      }
    }, () => (this.status = 'error'));

    let contactsSeed = true;
    this.contactsSub = this.contactsFromPeopleService.contacts$.subscribe(cards => {
      const seedEmpty = contactsSeed && cards.length === 0;
      contactsSeed = false;
      this.applyFilters(cards);
      if (!seedEmpty) {
        this.contactsArrived = true;
        this.updateStatus();
      }
    }, () => (this.status = 'error'));
  }

  private updateStatus(): void {
    if (this.contactsArrived && this.clansArrived) {
      this.status = 'ready';
    }
  }

  openPersonDetail(personId: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: personId },
      queryParamsHandling: 'merge'
    });
    this.selectedPersonId = personId;
  }

  closeModal(): void {
    this.selectedPersonId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: null },
      queryParamsHandling: 'merge'
    });
  }

  onFilterChange(query: string): void {
    this.searchTerm = query;
    this.updateQueryParams();
    this.applyFiltersFromParams();
  }

  clearFilter(): void {
    this.searchTerm = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: null },
      queryParamsHandling: 'merge'
    });
    this.applyFiltersFromParams();
  }

  onClanChange(): void {
    this.updateQueryParams();
    this.applyFiltersFromParams();
  }

  private applyFiltersFromParams(): void {
    this.contactsFromPeopleService.contacts$.subscribe(cards => {
      this.applyFilters(cards);
    }, () => (this.status = 'error')).add(() => {});
  }

  clearClanFilter(): void {
    this.selectedClan = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { clan: null },
      queryParamsHandling: 'merge'
    });
  }

  private applyFilters(cards: ContactCard[]): void {
    let filtered = cards;

    if (this.selectedClan) {
      filtered = filtered.filter(card => {
        const clanName = card.clan?.name?.toLowerCase() || '';
        return clanName === this.selectedClan.toLowerCase();
      });
    }

    if (this.searchTerm.trim()) {
      const query = this.searchTerm.toLowerCase();
      filtered = filtered.filter(card => {
        const personName = this.getPersonName(card).toLowerCase();
        const spouseName = card.spouse ? this.getSpouseName(card).toLowerCase() : '';
        return personName.includes(query) || spouseName.includes(query);
      });
    }

    this.contacts = filtered;
  }

  private updateQueryParams(): void {
    const queryParams: any = {};
    if (this.searchTerm) {
      queryParams['filter'] = this.searchTerm;
    }
    if (this.selectedClan) {
      queryParams['clan'] = this.selectedClan;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  getPersonName(card: ContactCard): string {
    const first = card.person.name.firstPreferred || card.person.name.firstGiven || '';
    const last = card.person.name.last || '';
    return `${first} ${last}`.trim();
  }

  getSpouseName(card: ContactCard): string {
    if (!card.spouse) return '';
    const first = card.spouse.name.firstPreferred || card.spouse.name.firstGiven || '';
    const last = card.spouse.name.last || '';
    return `${first} ${last}`.trim();
  }

  getClans(): Clan[] {
    return this.clans;
  }
}