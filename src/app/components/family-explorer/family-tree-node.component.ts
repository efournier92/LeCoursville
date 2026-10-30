import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FamilyPerson } from 'src/app/services/family-explorer.service';
import { unitMatcher } from '../shared/tree-filter';
import { personName, TreeNode } from './family-tree.model';

@Component({
  selector: 'app-family-tree-node',
  templateUrl: './family-tree-node.component.html',
  styleUrls: ['./family-tree-node.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FamilyTreeNodeComponent {
  @Input() node!: TreeNode;
  @Input() depth = 0;
  @Input() search = '';
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();

  personName = personName;

  subtreeMatches(node: TreeNode): boolean {
    return unitMatcher(this.search, personName)(node);
  }

  visibleChildren(): TreeNode[] {
    return this.node.children.filter(child => this.subtreeMatches(child));
  }

  isPinned(): boolean {
    return this.selectedId === this.node.person.id
      || this.node.spouses.some(spouse => spouse.id === this.selectedId);
  }

  generationLabel(depth: number): string {
    return ['Children', 'Grandchildren', 'Great-Grandchildren'][depth] || 'Descendants';
  }

  marriageChips(): { personId: string; spouseId: string; year: number }[] {
    const chips: { personId: string; spouseId: string; year: number }[] = [];
    const seen = new Set<string>();
    for (const person of [this.node.person, ...this.node.spouses]) {
      for (const [spouseId, year] of Object.entries(person.marriageYears || {})) {
        const pair = [person.id, spouseId].sort().join('|');
        if (seen.has(pair)) {
          continue;
        }
        seen.add(pair);
        chips.push({ personId: person.id, spouseId, year });
      }
    }
    return chips;
  }

  onSelect(person: FamilyPerson): void {
    this.select.emit(person.id);
  }

  onKeydown(event: KeyboardEvent, person: FamilyPerson): void {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      return;
    }
    const units = Array.from(document.querySelectorAll<HTMLButtonElement>('.family-chart [data-person]'));
    const index = units.findIndex(unit => unit.dataset['person'] === person.id);
    if (index === -1) {
      return;
    }
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const target = forward
      ? (index + 1) % units.length
      : (index - 1 + units.length) % units.length;
    event.preventDefault();
    units[target].focus();
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      this.select.emit(units[target].dataset['person'] || '');
    }
  }
}
