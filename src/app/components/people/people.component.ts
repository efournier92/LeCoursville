import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Person } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';
import { PeopleService } from 'src/app/services/people.service';
import { ClanService } from 'src/app/services/clan.service';
import { AppSettings } from 'src/environments/app-settings';

interface PersonNode {
  person: Person;
  spouse: Person | null;
  children: PersonNode[];
  level: number;
}

interface FamilyGroup {
  clan: string;
  displayName: string;
  firstGeneration: PersonNode[];
  roots: PersonNode[];
  memberCount: number;
  livingMemberCount: number;
}

interface TableRow {
  person: Person;
  personName: string;
  spouseName: string | null;
  spousePersonId: string | null;
  colorHex: string;
  indentPx: number;
  isRoot: boolean;
  hasChildren: boolean;
  nodeKey: string;
}

@Component({
  selector: 'app-people',
  templateUrl: './people.component.html',
  styleUrls: ['./people.component.scss']
})
export class PeopleComponent implements OnInit, OnDestroy {
  allPeople: Person[] = [];
  filteredPeople: Person[] = [];
  familyGroups: FamilyGroup[] = [];
  filterQuery = '';
  selectedFamily = '';
  selectedPersonId: string | null = null;
  private subscription: Subscription | null = null;
  private clanSubscription: Subscription | null = null;
  private peopleMap: Map<string, Person> = new Map();
  private clansMap: Map<string, Clan> = new Map();
  private clansByIdMap: Map<string, Clan> = new Map();
  skeletonIterations = [1,2,3,4,5,6,7,8,9,10];

  constructor(
    private peopleService: PeopleService,
    private clanService: ClanService,
    public router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.peopleService.people$.subscribe(
      (people: Person[]) => {
        this.allPeople = people;
        this.peopleMap = new Map(this.allPeople.map(p => [p.id, p]));
        this.applyFilter();
      }
    );

    this.clanSubscription = this.clanService.clans$.subscribe(
      (clans: Clan[]) => {
        this.clansMap = new Map(clans.map(c => [c.name.toLowerCase(), c]));
        this.clansByIdMap = new Map(clans.map(c => [c.id, c]));
        this.applyFilter();
      }
    );

    this.route.queryParamMap.subscribe(queryParams => {
      this.selectedFamily = queryParams.get('clan') || '';
      this.filterQuery = queryParams.get('filter') || '';
      this.selectedPersonId = queryParams.get('selected') || null;
      this.applyFilter();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.clanSubscription?.unsubscribe();
  }

  onFilterChange(query: string): void {
    this.filterQuery = query;
    if (query) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { filter: query },
        queryParamsHandling: 'merge'
      });
    } else {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {}
      });
    }
    this.applyFilter();
  }

  onFamilyChange(): void {
    if (this.selectedFamily) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { clan: this.selectedFamily },
        queryParamsHandling: 'merge'
      });
    } else {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {}
      });
    }
    this.applyFilter();
  }

  clearFamilyFilter(): void {
    this.selectedFamily = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    });
  }

  getFamilies(): Clan[] {
    const clans = Array.from(this.clansMap.values());
    const sorted = clans.sort((a, b) => {
      return (a.sortOrder || a.name).localeCompare(b.sortOrder || b.name);
    });
    return sorted;
  }

  openPersonDetail(id: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: id },
      queryParamsHandling: 'merge'
    });
  }

  closeModal(): void {
    this.selectedPersonId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: null },
      queryParamsHandling: 'merge'
    });
  }

  getPersonIdFromUrl(): string | null {
    return this.selectedPersonId;
  }

  formatBirthday(person: Person): string {
    if (!person.birthday) return '-';
    const { year, month, day } = person.birthday;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private applyFilter(): void {
    let filtered = this.allPeople;
    if (this.filterQuery.trim()) {
      const query = this.filterQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.firstGiven && p.name.firstGiven.toLowerCase().includes(query) ||
        (p.name.firstPreferred && p.name.firstPreferred.toLowerCase().includes(query))
      );
    }
    if (this.selectedFamily) {
      const clan = this.clansMap.get(this.selectedFamily.toLowerCase());
      if (clan) {
        filtered = filtered.filter(p => p.clanId === clan.id);
      }
    }
    this.filteredPeople = filtered;

    const visiblePeople = filtered.filter(p =>
      p.generationNumber > 0
    );

    if (this.filterQuery.trim()) {
      const matchedIds = this.getMatchedPersonIds(this.filterQuery);
      const ancestorIds = this.getAncestorIdsSet(matchedIds);
      const descendantIds = this.getDescendantIds(matchedIds);
      const visibleIds = new Set([...matchedIds, ...ancestorIds, ...descendantIds]);
      this.addSpousesToVisibleSet(visibleIds);

      this.familyGroups = this.buildFamilyGroupsWithFilteredTrees(visiblePeople, visibleIds);
    } else {
      this.familyGroups = this.buildFamilyGroups(visiblePeople);
    }
  }

  getMatchedPersonIds(filterQuery: string): Set<string> {
    const query = filterQuery.toLowerCase();
    const matched = new Set<string>();
    for (const p of this.allPeople) {
      if (p.id.endsWith('-S')) {
        // When spouse name matches, add the regular person ID instead
        if (p.name.firstGiven && p.name.firstGiven.toLowerCase().includes(query) ||
            (p.name.firstPreferred && p.name.firstPreferred.toLowerCase().includes(query))) {
          const regularId = p.id.replace('-S', '');
          matched.add(regularId);
        }
        continue;
      }
      if (p.name.firstGiven && p.name.firstGiven.toLowerCase().includes(query) ||
          (p.name.firstPreferred && p.name.firstPreferred.toLowerCase().includes(query))) {
        matched.add(p.id);
      }
    }
    return matched;
  }

  getAncestorIdsSet(matchedIds: Set<string>): Set<string> {
    const ancestors = new Set<string>();
    const toProcess = [...matchedIds];
    while (toProcess.length > 0) {
      const id = toProcess.pop()!;
      const person = this.peopleMap.get(id);
      if (!person || !person.parentIds) continue;
      for (const parentId of person.parentIds) {
        if (!ancestors.has(parentId) && this.peopleMap.has(parentId)) {
          ancestors.add(parentId);
          toProcess.push(parentId);
        }
      }
    }
    return ancestors;
  }

  getDescendantIds(matchedIds: Set<string>): Set<string> {
    const descendants = new Set<string>();
    const toProcess = [...matchedIds];
    while (toProcess.length > 0) {
      const id = toProcess.pop()!;
      for (const [personId, person] of this.peopleMap) {
        if (personId.endsWith('-S')) continue;
        if (person.parentIds && person.parentIds.includes(id)) {
          if (!descendants.has(personId)) {
            descendants.add(personId);
            toProcess.push(personId);
          }
        }
      }
    }
    return descendants;
  }

  addSpousesToVisibleSet(visibleIds: Set<string>): void {
    const spouseIds = new Set<string>();
    for (const id of visibleIds) {
      spouseIds.add(id + '-S');
    }
    for (const spouseId of spouseIds) {
      if (this.peopleMap.has(spouseId)) {
        visibleIds.add(spouseId);
      }
    }
  }

  filterTreeByVisibility(nodes: PersonNode[], visibleIds: Set<string>): PersonNode[] {
    const result: PersonNode[] = [];
    for (const node of nodes) {
      if (!visibleIds.has(node.person.id)) {
        continue;
      }
      const filteredChildren = this.filterTreeByVisibility(node.children, visibleIds);
      result.push({ ...node, children: filteredChildren });
    }
    return result;
  }

  private buildFamilyGroupsWithFilteredTrees(visiblePeople: Person[], visibleIds: Set<string>): FamilyGroup[] {
    const clanIds = new Set<string>();
    for (const person of visiblePeople) {
      if (person.clanId) clanIds.add(person.clanId);
    }
    const clans = Array.from(clanIds)
      .map(id => this.clansByIdMap.get(id))
      .filter((c): c is Clan => c !== undefined)
      .sort((a, b) => {
        return (a.sortOrder || a.name).localeCompare(b.sortOrder || b.name);
      });

    const groups: FamilyGroup[] = [];
    for (const clan of clans) {
      const clanPeople = this.allPeople.filter(p => p.clanId === clan.id);
      if (clanPeople.length === 0) continue;
      const firstGenFiltered = this.filterTreeByVisibility(
        this.findFirstGeneration(clanPeople),
        visibleIds
      );
      const rootsFiltered = this.filterTreeByVisibility(
        this.findRootNodes(clanPeople, clanPeople),
        visibleIds
      );
      if (firstGenFiltered.length === 0 && rootsFiltered.length === 0) continue;
      groups.push({
        clan: clan.name,
        displayName: this.getClanDisplayName(clan.name, firstGenFiltered),
        firstGeneration: firstGenFiltered,
        roots: rootsFiltered,
        memberCount: clanPeople.length,
        livingMemberCount: clanPeople.filter(p => p.isLiving !== false).length
      });
    }

    return groups;
  }

  private buildFamilyGroups(visiblePeople: Person[]): FamilyGroup[] {
    const clanIds = new Set<string>();
    for (const person of visiblePeople) {
      if (person.clanId) clanIds.add(person.clanId);
    }
    const clans = Array.from(clanIds)
      .map(id => this.clansByIdMap.get(id))
      .filter((c): c is Clan => c !== undefined)
      .sort((a, b) => {
        return (a.sortOrder || a.name).localeCompare(b.sortOrder || b.name);
      });

    const groups: FamilyGroup[] = [];
    for (const clan of clans) {
      const clanPeople = visiblePeople.filter(p => p.clanId === clan.id);
      if (clanPeople.length === 0) continue;
      const allClanPeople = this.allPeople.filter(p => p.clanId === clan.id);
      const firstGeneration = this.findFirstGeneration(clanPeople);
      const roots = this.findRootNodes(clanPeople, allClanPeople);
      groups.push({
        clan: clan.name,
        displayName: this.getClanDisplayName(clan.name, firstGeneration),
        firstGeneration,
        roots,
        memberCount: clanPeople.length,
        livingMemberCount: allClanPeople.filter(p => p.isLiving !== false).length
      });
    }

    return groups;
  }

  private findFirstGeneration(clanPeople: Person[]): PersonNode[] {
    const gen1People = clanPeople.filter(p => p.generationNumber === 1 && !p.id.endsWith('-S'));
    const nodes: PersonNode[] = [];
    for (const person of gen1People) {
      const spouseId = person.id + '-S';
      const spouse = clanPeople.find(p => p.id === spouseId) || null;
      const node = this.buildNode(person, spouse, 0, clanPeople);
      nodes.push(node);
    }
    return nodes;
  }

  findRootNodes(clanPeople: Person[], allPeople: Person[]): PersonNode[] {
    // Tree starts at generation 2 (children of gen 1)
    const gen2People = clanPeople.filter(p => p.generationNumber === 2 && !p.id.endsWith('-S'));

    const nodes: PersonNode[] = [];
    for (const person of gen2People) {
      const spouseId = person.id + '-S';
      const spouse = allPeople.find(p => p.id === spouseId) || null;
      const node = this.buildNode(person, spouse, 0, allPeople);
      nodes.push(node);
    }

    return nodes;
  }

  private buildNode(person: Person, spouse: Person | null, level: number, allPeople: Person[]): PersonNode {
    const children = this.findChildren(person, spouse, allPeople, level);
    children.sort((a, b) => {
      if (a.person.generationNumber !== b.person.generationNumber) {
        return a.person.generationNumber - b.person.generationNumber;
      }
      return a.person.id.localeCompare(b.person.id);
    });

    return {
      person,
      spouse,
      children,
      level
    };
  }

  private findChildren(person: Person, spouse: Person | null, allPeople: Person[], level: number): PersonNode[] {
    const parentIds = new Set<string>();
    parentIds.add(person.id);
    if (spouse) {
      parentIds.add(spouse.id);
    }

    const children: Person[] = [];
    for (const p of allPeople) {
      if (p.id.endsWith('-S')) continue;
      if (p.parentIds && p.parentIds.length > 0) {
        // Match if any parentId matches (handles spouse as parent too)
        const hasMatchingParent = p.parentIds.some(parentId => parentIds.has(parentId));
        if (hasMatchingParent) {
          children.push(p);
        }
      }
    }

    const nodes: PersonNode[] = [];
    for (const child of children) {
      const childSpouseId = child.id + '-S';
      const childSpouse = allPeople.find(p => p.id === childSpouseId && p.isLiving !== false) || null;
      const node = this.buildNode(child, childSpouse, level + 1, allPeople);
      nodes.push(node);
    }

    return nodes;
  }

  getGroupedPeopleEntries(): FamilyGroup[] {
    return this.familyGroups;
  }

  getFamilyColorForClan(clan: string): string {
    const clanObj = this.clansMap.get(clan.toLowerCase());
    if (clanObj) {
      return clanObj.hexColor;
    }
    return '#e0e0e0';
  }

  getFamilyColorForClanTransparent(clan: string): string {
    const clanObj = this.clansMap.get(clan.toLowerCase());
    if (clanObj) {
      return this.hexToRgba(clanObj.hexColor, 0.6);
    }
    return '#e0e0e060';
  }

  getClanDisplayName(clan: string, roots: PersonNode[]): string {
    return clan + "'s Family";
  }

  getNodeIndent(node: PersonNode): number {
    return node.level * 25;
  }

  hasChildren(node: PersonNode): boolean {
    return node.children.length > 0;
  }

  getNodeChildren(node: PersonNode): PersonNode[] {
    return node.children;
  }

  getPersonName(node: PersonNode): string {
    const first = node.person.name.firstPreferred || '';
    const last = node.person.name.last || '';
    if (node.spouse && last && last === node.spouse.name.last) {
      return first;
    }
    return `${first} ${last}`.trim();
  }

  getSpouseName(node: PersonNode): string | null {
    if (!node.spouse) return null;
    const first = node.spouse.name.firstPreferred || '';
    const last = node.spouse.name.last || '';
    return `${first} ${last}`.trim();
  }

  getSpouseId(node: PersonNode): string | null {
    return node.spouse ? node.spouse.id : null;
  }

  getPersonId(node: PersonNode): string {
    return node.person.id;
  }

  getColorHex(node: PersonNode): string {
    if (node.person.clanId) {
      const clan = this.clansByIdMap.get(node.person.clanId);
      if (clan) {
        return this.hexToRgba(clan.hexColor, 0.5);
      }
    }
    return '#e0e0e080';
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  isRootNode(node: PersonNode, level: number): boolean {
    return level === 0;
  }

  isPersonDeceased(node: PersonNode): boolean {
    return node.person.isLiving === false;
  }

  isSpouseDeceased(node: PersonNode): boolean {
    return node.spouse ? node.spouse.isLiving === false : false;
  }
}