import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { FamilyPerson } from 'src/app/services/family-explorer.service';
import { personName, yearsOf, childIdsFor } from './family-tree.model';
import { fullName, firstName } from '../shared/person-name';
import { formatLongDate, formatMonthYear, yearOf } from '../shared/person-date';
import { PersonNode } from 'src/app/components/shared/person-tree/person-tree.component';

@Component({
  selector: 'app-family-panel',
  templateUrl: './family-panel.component.html',
  styleUrls: ['./family-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FamilyPanelComponent implements OnChanges {
  @Input() person: FamilyPerson | null = null;
  @Input() people: Record<string, FamilyPerson> | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  /** Brief hidden state while swapping to a new person, for the 140ms fade. */
  switching = false;

  /** Ancestors above, spouse inline, descendants below — the People modal's lineage subset. */
  lineage: PersonNode[] = [];
  /** Branch tint for the lineage generation bars, resolved where the tree renders. */
  readonly branchTint = 'var(--family-color, var(--color-brand-primary))';

  personName = personName;
  yearsOf = yearsOf;

  private peopleList: FamilyPerson[] = [];
  private byIdMap = new Map<string, FamilyPerson>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['people']) {
      this.peopleList = this.people ? Object.values(this.people) : [];
      this.byIdMap = new Map(this.peopleList.map(entry => [entry.id, entry]));
    }
    if (changes['person']) {
      this.lineage = this.buildLineage(this.person);
    }
    if (changes['person'] && !changes['person'].firstChange) {
      this.switching = true;
      setTimeout(() => {
        this.switching = false;
      });
    }
  }

  // --- Lineage subset (shares person-detail-modal's PersonNode shape, not its data contract) ---

  private byId(id: string | null | undefined): FamilyPerson | null {
    return (id && this.people?.[id]) || null;
  }

  /** Person-tree renders only id + name parts; a narrow shape is enough. */
  private asNodePerson(person: FamilyPerson): NonNullable<PersonNode['person']> {
    const full = fullName(person);
    const first = firstName(person);
    const last = person.surname || full.split(/\s+/).slice(1).join(' ');
    return {
      id: person.id,
      name: {
        firstGiven: first,
        firstPreferred: '',
        maiden: '',
        last,
        suffix: person.suffix || null,
      },
    } as NonNullable<PersonNode['person']>;
  }

  private firstSpouse(person: FamilyPerson): PersonNode['spouse'] {
    const spouse = this.byId(person.spouseIds?.[0]);
    return spouse ? this.asNodePerson(spouse) : null;
  }

  private childrenOf(person: FamilyPerson): FamilyPerson[] {
    const spouses = (person.spouseIds || [])
      .map(id => this.byIdMap.get(id))
      .filter((spouse): spouse is FamilyPerson => !!spouse);
    return childIdsFor(this.peopleList, this.byIdMap, person, spouses)
      .map(id => this.byIdMap.get(id))
      .filter((child): child is FamilyPerson => !!child)
      .sort((a, b) => (yearOf(a.birthDate) ? Number(yearOf(a.birthDate)) : Number.POSITIVE_INFINITY)
        - (yearOf(b.birthDate) ? Number(yearOf(b.birthDate)) : Number.POSITIVE_INFINITY)
        || personName(a).localeCompare(personName(b)));
  }

  private buildLineage(person: FamilyPerson | null): PersonNode[] {
    if (!person || !this.people) {
      return [];
    }
    const visited = new Set<string>([person.id, ...(person.spouseIds || [])]);

    const descendantsOf = (current: FamilyPerson, level: number): PersonNode => {
      const node: PersonNode = {
        person: this.asNodePerson(current),
        spouse: this.firstSpouse(current),
        children: [],
        level,
      };
      for (const child of this.childrenOf(current)) {
        if (visited.has(child.id)) {
          continue;
        }
        visited.add(child.id);
        for (const spouseId of child.spouseIds || []) {
          visited.add(spouseId);
        }
        node.children.push(descendantsOf(child, level + 1));
      }
      return node;
    };

    let root = descendantsOf(person, 1);
    let current = person;
    // Wrap the ancestor chain above the person, exactly like the modal.
    for (let hop = 0; hop < 20; hop++) {
      const father = this.byId(current.fatherId);
      const mother = this.byId(current.motherId);
      if (!father && !mother) {
        break;
      }
      const primary = father ?? mother!;
      if (visited.has(primary.id)) {
        break;
      }
      visited.add(primary.id);
      root = {
        person: this.asNodePerson(primary),
        spouse: father && mother ? this.asNodePerson(mother) : null,
        children: [root],
        level: root.level - 1,
      };
      current = primary;
    }
    return [root];
  }

  sexLabel(sex: string | null | undefined): string {
    if (sex === 'M') {
      return 'Male';
    }
    if (sex === 'F') {
      return 'Female';
    }
    return '';
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) {
      return '';
    }
    if (/^(\d{4})-(\d{2})-(\d{2})$/.test(iso)) {
      return formatLongDate(iso);
    }
    if (/^(\d{4})-(\d{2})$/.test(iso)) {
      return formatMonthYear(iso);
    }
    return iso;
  }

  marriageEntries(person: FamilyPerson): { spouse: string; year: number; label: string }[] {
    return Object.entries(person.marriageYears || {}).map(([spouse, year]) => ({
      spouse,
      year,
      label: this.people?.[spouse] ? personName(this.people[spouse]) : spouse,
    }));
  }

  onSelect(id: string): void {
    this.select.emit(id);
  }
}
