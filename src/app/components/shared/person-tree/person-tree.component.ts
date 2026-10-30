import { Component, Input, Output, EventEmitter, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
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
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false,
    host: { '[class.person-tree--people]': "variant === 'people'" }
})
export class PersonTreeComponent {
  @Input() nodes: PersonNode[] = [];
  @Input() clickable = true;
  @Input() familyColorHex: string | null = null;
  @Input() selectedPersonId: string | null = null;
  @Input() variant: 'modal' | 'people' = 'modal';
  @Input() deceasedStyle = false;
  @Input() spouseSurnameDedupe = true;
  @Input() preferGivenFallback = true;
  @Input() colorForNode: ((node: PersonNode) => string) | null = null;
  @Output() personClick = new EventEmitter<string>();

  isSelected(node: PersonNode): boolean {
    return this.selectedPersonId === node.person.id ||
           this.selectedPersonId === node.spouse?.id;
  }

  private firstName(name: Person['name']): string {
    return name.firstPreferred || (this.preferGivenFallback ? name.firstGiven : '') || '';
  }

  getPersonName(node: PersonNode): string {
    const first = this.firstName(node.person.name);
    const last = node.person.name.last || '';
    if (this.spouseSurnameDedupe && node.spouse && last && last === node.spouse.name.last) {
      return first;
    }
    return `${first} ${last}`.trim();
  }

  getSpouseName(node: PersonNode): string {
    if (!node.spouse) return '';
    const first = this.firstName(node.spouse.name);
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

  getGenerationColor(node: PersonNode): string {
    if (this.colorForNode) return this.colorForNode(node);
    return this.familyColorHex || '#e0e0e0';
  }

  isPersonDeceased(node: PersonNode): boolean {
    return this.deceasedStyle && node.person.isLiving === false;
  }

  isSpouseDeceased(node: PersonNode): boolean {
    return this.deceasedStyle && !!node.spouse && node.spouse.isLiving === false;
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

  onNodeKeydown(event: KeyboardEvent, node: PersonNode): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onNodeClick(node);
    }
  }

  onSpouseKeydown(event: KeyboardEvent, node: PersonNode): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onSpouseClick(node);
    }
  }
}
