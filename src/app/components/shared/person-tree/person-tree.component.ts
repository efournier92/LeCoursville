import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { Person } from 'src/app/models/person';

export interface PersonNode {
  person: Person;
  spouse: Person | null;
  children: PersonNode[];
  level: number;
}

@Component({
  selector: 'app-person-tree',
  templateUrl: './person-tree.component.html',
  styleUrls: ['./person-tree.component.scss', '../../shared/tree-styles.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PersonTreeComponent {
  @Input() nodes: PersonNode[] = [];
  @Input() clickable = true;
  @Input() clanColorHex: string | null = null;
  @Input() selectedPersonId: string | null = null;
  @Output() personClick = new EventEmitter<string>();

  isSelected(node: PersonNode): boolean {
    return this.selectedPersonId === node.person.id ||
           this.selectedPersonId === node.spouse?.id;
  }

  getPersonName(node: PersonNode): string {
    const first = node.person.name.firstPreferred || node.person.name.firstGiven || '';
    const last = node.person.name.last || '';
    if (node.spouse && last && last === node.spouse.name.last) {
      return first;
    }
    return `${first} ${last}`.trim();
  }

  getSpouseName(node: PersonNode): string {
    if (!node.spouse) return '';
    const first = node.spouse.name.firstPreferred || node.spouse.name.firstGiven || '';
    const last = node.spouse.name.last || '';
    return `${first} ${last}`.trim();
  }

  getPersonId(node: PersonNode): string {
    return node.person.id;
  }

  getSpouseId(node: PersonNode): string {
    return node.spouse?.id || '';
  }

  getNodeChildren(node: PersonNode): PersonNode[] {
    return node.children;
  }

  hasChildren(node: PersonNode): boolean {
    return node.children && node.children.length > 0;
  }

  onNodeClick(node: PersonNode): void {
    if (this.clickable) {
      this.personClick.emit(node.person.id);
    }
  }

  onSpouseClick(node: PersonNode): void {
    if (this.clickable && node.spouse) {
      this.personClick.emit(node.spouse.id);
    }
  }
}