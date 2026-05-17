import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Person } from 'src/app/models/person';

export interface ImportResult {
  created: number;
  updated: number;
  inactive: number;
  conflicts: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PeopleService {
  private peopleSource: BehaviorSubject<Person[]> = new BehaviorSubject([]);
  people$: Observable<Person[]> = this.peopleSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getPeople().valueChanges().subscribe(
      (people: Person[]) => {
        this.peopleSource.next(people);
      }
    );
  }

  getPeople(): AngularFireList<Person> {
    return this.db.list('people');
  }

  getPerson(id: string): Observable<Person | null> {
    return this.db.object('people/' + id).valueChanges() as Observable<Person | null>;
  }

  savePerson(person: Person): void {
    this.db.object('people/' + person.id).set(person);
  }

  updatePerson(id: string, data: Partial<Person>): void {
    this.db.object('people/' + id).update(data);
  }

  importPeople(people: Person[]): Observable<ImportResult> {
    return new Observable(observer => {
      const existingPeople = this.peopleSource.getValue();
      const existingIds = new Set(existingPeople.map(p => p.id));

      let created = 0;
      let updated = 0;
      let inactive = 0;
      const conflicts: string[] = [];

      const updates: Record<string, any> = {};

      for (const person of people) {
        if (existingIds.has(person.id)) {
          updates['people/' + person.id] = person;
          updated++;
        } else {
          updates['people/' + person.id] = person;
          created++;
        }
      }

      for (const existing of existingPeople) {
        if (!people.find(p => p.id === existing.id)) {
          // Person not in incoming list - leave as-is (preserves data, no deprecated isActive field)
          inactive++;
        }
      }

      this.db.object('/').update(updates).then(() => {
        observer.next({ created, updated, inactive, conflicts });
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  getPeopleByAnniversary(anniversaryId: string): Observable<Person[]> {
    return this.people$.pipe(
      map(people => people.filter(p => p.anniversaryId === anniversaryId))
    );
  }

  getPeopleByAddress(addressId: string): Observable<Person[]> {
    return this.people$.pipe(
      map(people => people.filter(p => p.addressId === addressId))
    );
  }

  getAncestors(person: Person, allPeople: Person[]): Person[] {
    const ancestors: Person[] = [];
    const toProcess = [...(person.parentIds || [])];
    const seen = new Set<string>();

    while (toProcess.length > 0) {
      const parentId = toProcess.pop()!;
      if (seen.has(parentId)) continue;
      seen.add(parentId);
      const parent = allPeople.find(p => p.id === parentId);
      if (parent) {
        ancestors.push(parent);
        if (parent.parentIds) {
          for (const id of parent.parentIds) {
            if (!seen.has(id)) toProcess.push(id);
          }
        }
      }
    }
    return ancestors;
  }

  getDescendants(person: Person, allPeople: Person[]): Person[] {
    const descendants: Person[] = [];
    const toProcess = [person.id];
    const seen = new Set<string>();

    while (toProcess.length > 0) {
      const parentId = toProcess.pop()!;
      for (const p of allPeople) {
        if (p.id.endsWith('-S')) continue;
        if (p.parentIds && p.parentIds.includes(parentId) && !seen.has(p.id)) {
          seen.add(p.id);
          descendants.push(p);
          toProcess.push(p.id);
        }
      }
    }
    return descendants;
  }

  buildLineageTree(person: Person, allPeople: Person[]): { ancestors: Person[]; descendants: Person[]; ancestorTree: any; descendantTree: any } {
    const ancestors = this.getAncestors(person, allPeople);
    const descendants = this.getDescendants(person, allPeople);
    const ancestorTree = this.buildAncestorTree(person, allPeople);
    const descendantTree = this.buildDescendantTree(descendants, allPeople);
    return { ancestors, descendants, ancestorTree, descendantTree };
  }

  buildModalLineageTree(person: Person, allPeople: Person[]): any[] {
    // Find the person's spouse
    const spouseId = person.id + '-S';
    const spouse = allPeople.find(p => p.id === spouseId) || null;

    // Build ancestor chain above the person (walk up parentIds to generation 0)
    const ancestorChain = this.buildAncestorChainAbove(person, allPeople);

    // Build full descendant tree below the person
    const descendantTree = this.buildDescendantTreeForModal(person, allPeople);

    // Assemble: root node = person + spouse, with ancestors as chain above and descendants below
    return [{
      person,
      spouse,
      ancestors: ancestorChain,
      descendants: descendantTree,
      level: 0
    }];
  }

  private buildAncestorChainAbove(person: Person, allPeople: Person[]): any[] {
    // Walk UP from the person through parentIds until generationNumber reaches 0
    const chain: any[] = [];
    let current: Person | null = person;
    const visited = new Set<string>();

    while (current && current.generationNumber > 0 && current.parentIds && current.parentIds.length > 0) {
      const parentId = current.parentIds[0]; // take first parent for vertical chain
      if (visited.has(parentId)) break;
      visited.add(parentId);
      const parent = allPeople.find(p => p.id === parentId);
      if (!parent || parent.id.endsWith('-S')) break;

      const parentSpouseId = parent.id + '-S';
      const parentSpouse = allPeople.find(p => p.id === parentSpouseId) || null;

      chain.push({
        person: parent,
        spouse: parentSpouse,
        children: [],
        level: 0
      });
      current = parent;
    }

    // chain is built from immediate parent outward, so oldest ancestor is last
    // Return as-is: oldest ancestor first in array for display purposes
    return chain;
  }

  private buildDescendantTreeForModal(person: Person, allPeople: Person[]): any[] {
    // Get direct children of this person
    const children = allPeople.filter(p =>
      !p.id.endsWith('-S') &&
      p.parentIds &&
      p.parentIds.includes(person.id)
    );

    const result: any[] = [];
    for (const child of children) {
      result.push(this.buildDescendantNodeForModal(child, allPeople));
    }
    return result;
  }

  private buildDescendantNodeForModal(person: Person, allPeople: Person[]): any {
    const spouseId = person.id + '-S';
    const spouse = allPeople.find(p => p.id === spouseId) || null;

    const childNodes: any[] = [];
    const children = allPeople.filter(p =>
      !p.id.endsWith('-S') &&
      p.parentIds &&
      p.parentIds.includes(person.id)
    );
    for (const child of children) {
      childNodes.push(this.buildDescendantNodeForModal(child, allPeople));
    }

    return { person, spouse, children: childNodes, level: 0 };
  }

  private buildAncestorTree(person: Person, allPeople: Person[]): any[] {
    const result: any[] = [];
    result.push(this.buildAncestorNode(person, allPeople, new Set<string>()));
    return result;
  }

  private buildAncestorNode(person: Person, allPeople: Person[], visited: Set<string>): any {
    if (visited.has(person.id)) {
      return { person, spouse: null, children: [], level: 0 };
    }
    visited.add(person.id);

    // Find immediate parents
    const parentNodes: any[] = [];
    if (person.parentIds) {
      for (const parentId of person.parentIds) {
        const parent = allPeople.find(p => p.id === parentId);
        if (parent && !parent.id.endsWith('-S') && !visited.has(parent.id)) {
          parentNodes.push(this.buildAncestorNode(parent, allPeople, visited));
        }
      }
    }

    // Find spouse
    const spouseId = person.id + '-S';
    const spouse = allPeople.find(p => p.id === spouseId) || null;

    return { person, spouse, children: parentNodes, level: 0 };
  }

  private buildDescendantTree(lineagePeople: Person[], allPeople: Person[]): any[] {
    if (lineagePeople.length === 0) return [];
    const lineageSet = new Set(lineagePeople.map(p => p.id));

    // Find roots: people whose parents are NOT in the lineage set
    const roots = lineagePeople.filter(person => {
      if (person.id.endsWith('-S')) return false;
      if (!person.parentIds || person.parentIds.length === 0) return true;
      return !person.parentIds.some(pid => lineageSet.has(pid));
    });

    const result: any[] = [];
    for (const root of roots) {
      result.push(this.buildDescendantNode(root, lineagePeople, lineageSet));
    }
    return result;
  }

  private buildDescendantNode(person: Person, lineagePeople: Person[], lineageSet: Set<string>): any {
    const children = lineagePeople.filter(p =>
      !p.id.endsWith('-S') &&
      p.parentIds &&
      p.parentIds.includes(person.id)
    );

    const spouseId = person.id + '-S';
    const spouse = lineagePeople.find(p => p.id === spouseId) || null;

    const childNodes: any[] = [];
    for (const child of children) {
      childNodes.push(this.buildDescendantNode(child, lineagePeople, lineageSet));
    }

    return { person, spouse, children: childNodes, level: 0 };
  }
}