import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  SimpleChanges,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FamilyPerson } from 'src/app/services/family-explorer.service';
import { unitMatcher } from '../shared/tree-filter';
import { firstName } from '../shared/person-name';
import { Branch, TreeNode, buildBranches, personName } from './family-tree.model';

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

  personName = personName;

  /** Card title: "Marguerite's Family" — first given name, possessive. */
  branchHeadLabel(person: FamilyPerson): string {
    return `${firstName(person)}'s Family`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['people']) {
      this.branches = buildBranches(this.people);
    }
  }

  subtreeMatches(node: TreeNode): boolean {
    return unitMatcher(this.search, personName)(node);
  }

  visibleBranches(): Branch[] {
    return this.branches.filter(branch => this.subtreeMatches(branch.tree));
  }
}
