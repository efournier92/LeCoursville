import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Person } from 'src/app/models/person';
import { Family } from 'src/app/models/family';
import { PeopleService } from 'src/app/services/people.service';
import { FamilyService } from 'src/app/services/family.service';
import { AppSettings } from 'src/environments/app-settings';

interface PersonNode {
  person: Person;
  spouse: Person | null;
  children: PersonNode[];
  level: number;
}

interface FamilyGroup {
  family: string;
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
    styleUrls: ['./people.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PeopleComponent implements OnInit, OnDestroy {
  allPeople: Person[] = [];
  filteredPeople: Person[] = [];
  familyGroups: FamilyGroup[] = [];
  filterQuery = '';
  selectedFamily = '';
  selectedPersonId: string | null = null;
  status: 'loading' | 'error' | 'ready' = 'loading';
  private subscription: Subscription | null = null;
  private familySubscription: Subscription | null = null;
  private peopleArrived = false;
  private familiesArrived = false;
  private peopleMap: Map<string, Person> = new Map();
  private familiesByNameMap: Map<string, Family> = new Map();
  private familiesByIdMap: Map<string, Family> = new Map();
  skeletonIterations = [1,2,3,4,5,6,7,8,9,10];

  constructor(
    private peopleService: PeopleService,
    private familyService: FamilyService,
    public router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscribePeople();
    this.subscribeFamilies();

    this.route.queryParamMap.subscribe(queryParams => {
      // The ?clan= alias is scheduled for deletion in the next release; remove this fallback then.
      const family = queryParams.get('family');
      this.selectedFamily = family || queryParams.get('clan') || '';
      this.filterQuery = queryParams.get('filter') || '';
      this.selectedPersonId = queryParams.get('selected') || null;
      if (!family && queryParams.get('clan')) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { family: queryParams.get('clan'), clan: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
      this.applyFilter();
    }, () => (this.status = 'error'));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.familySubscription?.unsubscribe();
  }

  retry(): void {
    this.status = 'loading';
    this.subscribePeople();
    this.subscribeFamilies();
  }

  // The services seed BehaviorSubjects with [], so a synchronous replay of an
  // empty list is still the seed, not data.
  // minimalist: a warm route into a genuinely empty dataset waits for the next
  // fresh emit; expose a loaded$ on the services if that ever matters.
  private subscribePeople(): void {
    this.peopleArrived = false;
    this.subscription?.unsubscribe();
    let isSeed = true;
    this.subscription = this.peopleService.people$.subscribe(
      (people: Person[]) => {
        const seedEmpty = isSeed && people.length === 0;
        isSeed = false;
        this.allPeople = people;
        this.peopleMap = new Map(this.allPeople.map(p => [p.id, p]));
        this.applyFilter();
        if (!seedEmpty) {
          this.peopleArrived = true;
          this.updateStatus();
        }
      },
      () => (this.status = 'error'),
    );
  }

  private subscribeFamilies(): void {
    this.familiesArrived = false;
    this.familySubscription?.unsubscribe();
    let isSeed = true;
    this.familySubscription = this.familyService.families$.subscribe(
      (families: Family[]) => {
        const seedEmpty = isSeed && families.length === 0;
        isSeed = false;
        this.familiesByNameMap = new Map(families.map(f => [f.name.toLowerCase(), f]));
        this.familiesByIdMap = new Map(families.map(f => [f.id, f]));
        this.applyFilter();
        if (!seedEmpty) {
          this.familiesArrived = true;
          this.updateStatus();
        }
      },
      () => (this.status = 'error'),
    );
  }

  private updateStatus(): void {
    if (this.peopleArrived && this.familiesArrived) {
      this.status = 'ready';
    }
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
        queryParams: { filter: null },
        queryParamsHandling: 'merge'
      });
    }
    this.applyFilter();
  }

  onFamilyChange(): void {
    if (this.selectedFamily) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { family: this.selectedFamily, clan: null },
        queryParamsHandling: 'merge'
      });
    } else {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { family: null, clan: null },
        queryParamsHandling: 'merge'
      });
    }
    this.applyFilter();
  }

  clearFamilyFilter(): void {
    this.selectedFamily = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { family: null, clan: null },
      queryParamsHandling: 'merge'
    });
  }

  getFamilies(): Family[] {
    const families = Array.from(this.familiesByNameMap.values());
    const sorted = families.sort((a, b) => {
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
        Object.values(p.name).some(val => val && val.toLowerCase().includes(query))
      );
    }
    if (this.selectedFamily) {
      const family = this.familiesByNameMap.get(this.selectedFamily.toLowerCase());
      if (family) {
        filtered = filtered.filter(p => p.familyId === family.id);
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
        if (Object.values(p.name).some(val => val && val.toLowerCase().includes(query))) {
          const regularId = p.id.replace('-S', '');
          matched.add(regularId);
        }
        continue;
      }
      if (Object.values(p.name).some(val => val && val.toLowerCase().includes(query))) {
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
    const familyIds = new Set<string>();
    for (const person of visiblePeople) {
      if (person.familyId) familyIds.add(person.familyId);
    }
    const families = Array.from(familyIds)
      .map(id => this.familiesByIdMap.get(id))
      .filter((f): f is Family => f !== undefined)
      .sort((a, b) => {
        return (a.sortOrder || a.name).localeCompare(b.sortOrder || b.name);
      });

    const groups: FamilyGroup[] = [];
    for (const family of families) {
      const familyPeople = this.allPeople.filter(p => p.familyId === family.id);
      if (familyPeople.length === 0) continue;
      const firstGenFiltered = this.filterTreeByVisibility(
        this.findFirstGeneration(familyPeople),
        visibleIds
      );
      const rootsFiltered = this.filterTreeByVisibility(
        this.findRootNodes(familyPeople, familyPeople),
        visibleIds
      );
      if (firstGenFiltered.length === 0 && rootsFiltered.length === 0) continue;
      groups.push({
        family: family.name,
        displayName: this.getFamilyDisplayName(family.name, firstGenFiltered),
        firstGeneration: firstGenFiltered,
        roots: rootsFiltered,
        memberCount: familyPeople.length,
        livingMemberCount: familyPeople.filter(p => p.isLiving !== false).length
      });
    }

    return groups;
  }

  private buildFamilyGroups(visiblePeople: Person[]): FamilyGroup[] {
    const familyIds = new Set<string>();
    for (const person of visiblePeople) {
      if (person.familyId) familyIds.add(person.familyId);
    }
    const families = Array.from(familyIds)
      .map(id => this.familiesByIdMap.get(id))
      .filter((f): f is Family => f !== undefined)
      .sort((a, b) => {
        return (a.sortOrder || a.name).localeCompare(b.sortOrder || b.name);
      });

    const groups: FamilyGroup[] = [];
    for (const family of families) {
      const familyPeople = visiblePeople.filter(p => p.familyId === family.id);
      if (familyPeople.length === 0) continue;
      const allFamilyPeople = this.allPeople.filter(p => p.familyId === family.id);
      const firstGeneration = this.findFirstGeneration(familyPeople);
      const roots = this.findRootNodes(familyPeople, allFamilyPeople);
      groups.push({
        family: family.name,
        displayName: this.getFamilyDisplayName(family.name, firstGeneration),
        firstGeneration,
        roots,
        memberCount: familyPeople.length,
        livingMemberCount: allFamilyPeople.filter(p => p.isLiving !== false).length
      });
    }

    return groups;
  }

  private findFirstGeneration(familyPeople: Person[]): PersonNode[] {
    const gen1People = familyPeople.filter(p => p.generationNumber === 1 && !p.id.endsWith('-S'));
    const nodes: PersonNode[] = [];
    for (const person of gen1People) {
      const spouseId = person.id + '-S';
      const spouse = familyPeople.find(p => p.id === spouseId) || null;
      const node = this.buildNode(person, spouse, 0, familyPeople);
      nodes.push(node);
    }
    return nodes;
  }

  findRootNodes(familyPeople: Person[], allPeople: Person[]): PersonNode[] {
    // Tree starts at generation 2 (children of gen 1)
    const gen2People = familyPeople.filter(p => p.generationNumber === 2 && !p.id.endsWith('-S'));

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

  getFamilyColorForName(name: string): string {
    const family = this.familiesByNameMap.get(name.toLowerCase());
    if (family) {
      return family.hexColor;
    }
    return '#e0e0e0';
  }

  getFamilyDisplayName(name: string, roots: PersonNode[]): string {
    return name + "'s Family";
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
    if (node.person.familyId) {
      const family = this.familiesByIdMap.get(node.person.familyId);
      if (family) {
        return this.hexToRgba(family.hexColor, 0.5);
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