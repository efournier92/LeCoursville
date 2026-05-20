import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Person } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { PeopleService } from 'src/app/services/people.service';
import { CalendarService } from 'src/app/services/calendar.service';
import { ClanService } from 'src/app/services/clan.service';

@Component({
  selector: 'app-person-detail-modal',
  templateUrl: './person-detail-modal.component.html',
  styleUrls: ['./person-detail-modal.component.scss']
})
export class PersonDetailModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() personId: string | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() openPerson = new EventEmitter<string>();

  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    this.onClose();
  }

  person: Person | null = null;
  spousePerson: Person | null = null;
  personEvents: RecurringEvent[] = [];
  lineageAncestors: Person[] = [];
  lineageDescendants: Person[] = [];
  lineageTree: any[] = [];
  private clansSource: Clan[] = [];
  private clansByIdMap: Map<string, Clan> = new Map();
  private clansByNameMap: Map<string, Clan> = new Map();
  private subscriptions: Subscription[] = [];
  private allPeople: Person[] = [];
  private pendingLineageBuild: boolean = false;

  constructor(
    private peopleService: PeopleService,
    private calendarService: CalendarService,
    private clanService: ClanService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.clanService.clans$.subscribe(clans => {
      this.clansSource = clans;
      this.clansByIdMap = new Map(clans.map(c => [c.id, c]));
      this.clansByNameMap = new Map(clans.map(c => [c.name.toLowerCase(), c]));
    });
    this.peopleService.people$.subscribe(people => {
      this.allPeople = people;
      if (this.pendingLineageBuild) {
        this.pendingLineageBuild = false;
        this.tryBuildLineage();
      }
    });
    if (this.personId) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['personId'] && !changes['personId'].firstChange) {
      this.loadData();
    }
  }

  private loadData(): void {
    this.resetData();
    if (this.personId) {
      this.loadPerson();
      this.loadPersonEvents();
    }
  }

  private resetData(): void {
    this.person = null;
    this.spousePerson = null;
    this.personEvents = [];
    this.lineageAncestors = [];
    this.lineageDescendants = [];
    this.lineageTree = [];
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadPerson(): void {
    const sub = this.peopleService.getPerson(this.personId!).subscribe(
      (person: Person | null) => {
        this.person = person;
        if (person && person.spouseId) {
          this.loadSpouse(person.spouseId);
        }
        this.tryBuildLineage();
      }
    );
    this.subscriptions.push(sub);
  }

  private tryBuildLineage(): void {
    if (this.person && this.allPeople.length > 0) {
      this.pendingLineageBuild = false;
      let lineagePerson = this.person;
      if (this.isSpouseRecord()) {
        lineagePerson = this.getRegularPerson(this.person) || this.allPeople.find(p => p.id === this.person!.spouseId) || this.person;
      }
      if (lineagePerson) {
        const visibleIds = this.getVisibleLineageIds(lineagePerson);
        this.lineageTree = this.buildLineageTreeFromIds(visibleIds, lineagePerson.id);
      }
    } else if (this.person && this.allPeople.length === 0) {
      this.pendingLineageBuild = true;
    }
  }

  private getRegularPerson(spousePerson: Person): Person | null {
    const regularId = spousePerson.id.replace('-S', '');
    return this.allPeople.find(p => p.id === regularId) || null;
  }

  private getLineagePersonId(): string | null {
    if (!this.person) return null;
    return this.person.id;
  }

  private getVisibleLineageIds(person: Person): Set<string> {
    const visibleIds = new Set<string>();
    visibleIds.add(person.id);

    if (person.spouseId) {
      visibleIds.add(person.spouseId);
    }

    const ancestors = this.getAncestorIds(person);
    ancestors.forEach(id => visibleIds.add(id));

    const descendants = this.getDescendantIds(person);
    descendants.forEach(id => visibleIds.add(id));

    return visibleIds;
  }

  private getAncestorIds(person: Person): Set<string> {
    const ancestors = new Set<string>();
    const toProcess = [person];
    const visited = new Set<string>();

    while (toProcess.length > 0) {
      const current = toProcess.pop()!;
      if (!current.parentIds) continue;
      for (const parentId of current.parentIds) {
        if (!visited.has(parentId)) {
          visited.add(parentId);
          const parent = this.allPeople.find(p => p.id === parentId);
          if (parent) {
            ancestors.add(parentId);
            if (parent.spouseId) ancestors.add(parent.spouseId);
            toProcess.push(parent);
          }
        }
      }
    }
    return ancestors;
  }

  private getDescendantIds(person: Person): Set<string> {
    const descendants = new Set<string>();
    const toProcess = [person];
    const visited = new Set<string>();

    while (toProcess.length > 0) {
      const current = toProcess.pop()!;
      for (const p of this.allPeople) {
        if (p.id.endsWith('-S')) continue;
        if (p.parentIds && p.parentIds.includes(current.id) && !visited.has(p.id)) {
          visited.add(p.id);
          descendants.add(p.id);
          if (p.spouseId) descendants.add(p.spouseId);
          toProcess.push(p);
        }
      }
    }
    return descendants;
  }

  private buildLineageTreeFromIds(visibleIds: Set<string>, selectedPersonId: string): any[] {
    const isSpouseViewer = this.isSpouseRecord();

    // For spouse viewers: first try standard ID lookup, then fall back to spouse's ID
    // (the fallback is needed for 0-S case where getRegularPerson('0-S') → '0' has no match,
    // but this.person.spouseId → '0-0' does)
    let regularPerson: Person | null = null;
    if (isSpouseViewer) {
      regularPerson = this.getRegularPerson(this.person!) || this.allPeople.find(p => p.id === this.person!.spouseId) || null;
    }

    const personForTree = isSpouseViewer ? (regularPerson || this.person) : (this.allPeople.find(p => p.id === selectedPersonId) || this.person);
    if (!personForTree) {
      return [];
    }

    // Build the root node and determine what ID to attach descendants from
    let personNode = this.buildNodeForPerson(personForTree);
    let descendantSourceId = personForTree.id;

    if (isSpouseViewer && regularPerson) {
      // Normal case: swap node so regular person is primary, spouse is the spouse field
      personNode.person = regularPerson;
      personNode.spouse = this.person;
      descendantSourceId = regularPerson.id;
    } else if (isSpouseViewer) {
      // 0-S edge case: regularPerson lookup failed, find the regular person via spouseId
      // and build the tree rooted there. The spouse record (0-S) becomes the spouse in the node.
      const regularPersonFromSpouse = this.allPeople.find(p => p.id === this.person!.spouseId) || null;
      if (regularPersonFromSpouse) {
        personNode.person = regularPersonFromSpouse;
        personNode.spouse = this.person;
        descendantSourceId = regularPersonFromSpouse.id;
      }
    }

    this.attachDescendantsFromPerson(personNode, descendantSourceId, visibleIds);

    // Build ancestor chain and wrap in hierarchy if this person has parents
    const ancestorChain = this.getAncestorChain(personForTree);
    if (ancestorChain.length > 0) {
      const oldestAncestor = ancestorChain[ancestorChain.length - 1];
      const oldestSpouseId = oldestAncestor.id.startsWith('0-') && !oldestAncestor.id.endsWith('-S')
        ? '0-S'
        : (oldestAncestor.id.endsWith('-S') ? oldestAncestor.id.replace('-S', '') : oldestAncestor.id + '-S');
      const oldestSpouse = this.allPeople.find(p => p.id === oldestSpouseId) || null;
      const rootNode = { person: oldestAncestor, spouse: oldestSpouse, children: [] };

      let parentNode = rootNode;
      for (let i = ancestorChain.length - 2; i >= 0; i--) {
        const anc = ancestorChain[i];
        const ancSpouseId = anc.id.startsWith('0-') && !anc.id.endsWith('-S')
          ? '0-S'
          : (anc.id.endsWith('-S') ? anc.id.replace('-S', '') : anc.id + '-S');
        const ancSpouse = this.allPeople.find(p => p.id === ancSpouseId) || null;
        const childNode = { person: anc, spouse: ancSpouse, children: [] };
        parentNode.children = [childNode];
        parentNode = childNode;
      }

      parentNode.children = [personNode];
      return [rootNode];
    }

    return [personNode];
  }

  private getAncestorChain(person: Person): Person[] {
    const chain: Person[] = [];
    let current: Person | null = person;
    const visited = new Set<string>();

    while (current && current.generationNumber >= 0 && current.parentIds && current.parentIds.length > 0) {
      const parentId = current.parentIds[0];
      if (visited.has(parentId)) break;
      visited.add(parentId);
      const parent = this.allPeople.find(p => p.id === parentId);
      if (!parent) break;
      chain.push(parent);
      current = parent;
    }
    return chain;
  }

  private buildNodeForPerson(person: Person): any {
    const spouseId = person.id.endsWith('-S')
      ? person.id.replace('-S', '')
      : (person.id.startsWith('0-') && !person.id.endsWith('-S') ? '0-S' : person.id + '-S');
    const spouse = this.allPeople.find(p => p.id === spouseId) || null;
    return { person, spouse, children: [] };
  }

  private attachDescendants(node: any, visibleIds: Set<string>): void {
    const children: Person[] = [];
    for (const p of this.allPeople) {
      if (p.id.endsWith('-S')) continue;
      if (p.parentIds && p.parentIds.includes(node.person.id) && visibleIds.has(p.id)) {
        children.push(p);
      }
    }

    for (const child of children) {
      const childNode = this.buildNodeForPerson(child);
      this.attachDescendants(childNode, visibleIds);
      node.children.push(childNode);
    }
  }

  private attachDescendantsFromPerson(node: any, sourcePersonOrId: Person | string, visibleIds: Set<string>): void {
    const children: Person[] = [];
    const sourceId = typeof sourcePersonOrId === 'string' ? sourcePersonOrId : sourcePersonOrId.id;
    for (const p of this.allPeople) {
      if (p.id.endsWith('-S')) continue;
      if (p.parentIds && p.parentIds.includes(sourceId) && visibleIds.has(p.id)) {
        children.push(p);
      }
    }

    for (const child of children) {
      const childNode = this.buildNodeForPerson(child);
      this.attachDescendantsFromPerson(childNode, child, visibleIds);
      node.children.push(childNode);
    }
  }

  private loadSpouse(spouseId: string): void {
    const sub = this.peopleService.getPerson(spouseId).subscribe(
      (spouse: Person | null) => {
        this.spousePerson = spouse;
      }
    );
    this.subscriptions.push(sub);
  }

  private loadPersonEvents(): void {
    const sub = this.calendarService.getEventsByPerson(this.personId!).subscribe(
      (events: RecurringEvent[]) => {
        this.personEvents = events;
      }
    );
    this.subscriptions.push(sub);
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }

  navigateToClan(clanName: string): void {
    this.router.navigate(['/people'], { queryParams: { clan: clanName, filter: null } });
  }

  navigateToPerson(id: string): void {
    this.openPerson.emit(id);
  }

  onSpouseClick(): void {
    if (this.spousePerson) {
      this.openPerson.emit(this.spousePerson.id);
    }
  }

  calculateAge(): string {
    if (!this.person?.birthday) return '';
    const { year, month, day } = this.person.birthday;
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  }

  formatDate(date: { year: number; month: number; day: number } | null): string {
    if (!date) return '-';
    const d = new Date(date.year, date.month - 1, date.day);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  getClanForPerson(clanId: string | null): Clan | null {
    if (!clanId) return null;
    return this.clansByIdMap.get(clanId) || null;
  }

  getClanByName(name: string): Clan | null {
    return this.clansByNameMap.get(name.toLowerCase()) || null;
  }

  getDisplayName(): string {
    if (!this.person) return '';
    const firstGiven = this.person.name.firstGiven || '';
    const maiden = this.person.name.maiden;
    const last = this.person.name.last || '';
    if (maiden) {
      return `${firstGiven} (${maiden}) ${last}`.trim();
    }
    return `${firstGiven} ${last}`.trim();
  }

  isSpouseRecord(): boolean {
    return this.person?.id.endsWith('-S') ?? false;
  }

  getSpouseName(): string {
    if (!this.spousePerson) return '';
    const first = this.spousePerson.name.firstPreferred || '';
    const last = this.spousePerson.name.last || '';
    return `${first} ${last}`.trim();
  }

  getPersonDisplayName(person: Person): string {
    const first = person.name.firstPreferred || person.name.firstGiven || '';
    const last = person.name.last || '';
    return `${first} ${last}`.trim();
  }

  getPersonGeneration(person: Person): number {
    return person.generationNumber || 0;
  }

  navigateToCalendar(date: { year: number; month: number; day: number } | null): void {
    if (date) {
      this.router.navigate(['/calendar'], { queryParams: { month: date.month } });
    }
  }

  onLineagePersonClick(personId: string): void {
    this.openPerson.emit(personId);
  }
}