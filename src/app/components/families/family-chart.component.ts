import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FamilyPerson } from 'src/app/services/family-archive.service';

interface Branch {
  root: FamilyPerson;
  generations: FamilyPerson[][];
}

const HOVER_DELAY_MS = 400;

export function personName(person: FamilyPerson): string {
  return person.name || [person.given, person.surname].filter(Boolean).join(' ') || person.id;
}

@Component({
  selector: 'app-family-chart',
  templateUrl: './family-chart.component.html',
  styleUrls: ['./family-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FamilyChartComponent implements OnChanges {
  @Input() people: FamilyPerson[] = [];
  @Input() search = '';
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();

  branches: Branch[] = [];
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  hoverId: string | null = null;

  ngOnChanges(): void {
    this.rebuild();
  }

  personName = personName;

  matches(person: FamilyPerson): boolean {
    if (!this.search.trim()) {
      return true;
    }
    return personName(person).toLowerCase().includes(this.search.trim().toLowerCase());
  }

  visibleBranches(): Branch[] {
    return this.branches.filter(branch =>
      branch.generations.some(row => row.some(person => this.matches(person))),
    );
  }

  rowVisible(row: FamilyPerson[]): boolean {
    return row.some(person => this.matches(person));
  }

  onSelect(person: FamilyPerson): void {
    this.select.emit(person.id);
  }

  onHoverStart(person: FamilyPerson): void {
    this.clearHover();
    // Poster behavior: details reveal only after a short hover dwell.
    this.hoverTimer = setTimeout(() => {
      this.hoverId = person.id;
    }, HOVER_DELAY_MS);
  }

  onHoverEnd(): void {
    this.clearHover();
  }

  onKeydown(event: KeyboardEvent, branchIndex: number, person: FamilyPerson): void {
    const branch = this.visibleBranches()[branchIndex];
    if (!branch) {
      return;
    }
    const units = branch.generations.flat().filter(p => this.matches(p));
    const index = units.findIndex(p => p.id === person.id);
    if (index === -1) {
      return;
    }
    let target = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      target = (index + 1) % units.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      target = (index - 1 + units.length) % units.length;
    }
    if (target >= 0) {
      event.preventDefault();
      document.querySelector<HTMLButtonElement>(`[data-testid="family-unit-${units[target].id}"]`)?.focus();
    }
  }

  private clearHover(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.hoverId = null;
  }

  private rebuild(): void {
    const byId = new Map(this.people.map(p => [p.id, p]));
    const hasParentInArchive = (p: FamilyPerson) =>
      (p.fatherId && byId.has(p.fatherId)) || (p.motherId && byId.has(p.motherId));
    const roots = this.people.filter(p => !hasParentInArchive(p));

    const claimed = new Set<string>();
    this.branches = [];
    for (const root of roots) {
      if (claimed.has(root.id)) {
        continue;
      }
      // Poster layout: a branch is the connected component below its founding
      // couple, so spouses and children join the walk and nobody renders twice.
      const generations: FamilyPerson[][] = [[root]];
      const seen = new Set([root.id]);
      let frontier = [root];
      while (frontier.length > 0) {
        const next: FamilyPerson[] = [];
        for (const member of frontier) {
          for (const relatedId of [...(member.spouseIds || []), ...(member.childIds || [])]) {
            if (!seen.has(relatedId) && byId.has(relatedId)) {
              seen.add(relatedId);
              next.push(byId.get(relatedId)!);
            }
          }
        }
        if (next.length > 0) {
          generations.push(next);
        }
        frontier = next;
      }
      for (const id of seen) {
        claimed.add(id);
      }
      this.branches.push({ root, generations });
    }
  }
}
