import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { FamilyExplorer, FamilyExplorerService, FamilyPerson } from 'src/app/services/family-explorer.service';
import { archiveGenerationCount, Branch, buildBranches, findFoundingCouple, personName, yearsOf } from './family-tree.model';
import { firstName } from '../shared/person-name';
import { treeContainsId } from '../shared/tree-filter';

@Component({
  selector: 'app-family-explorer',
  templateUrl: './family-explorer.component.html',
  styleUrls: ['./family-explorer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FamilyExplorerComponent implements OnInit, OnDestroy {
  familyId = '';
  loading = true;
  explorer: FamilyExplorer | null = null;
  available = false;
  people: FamilyPerson[] = [];
  searchText = '';
  selectedId: string | null = null;
  isDesktop = true;
  private desktopMedia?: MediaQueryList;
  private readonly onDesktopChange = (event: MediaQueryListEvent): void => {
    this.isDesktop = event.matches;
  };

  personName = personName;
  yearsOf = yearsOf;

  private sub?: Subscription;
  private routeSub?: Subscription;
  private archiveSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private explorers: FamilyExplorerService,
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.desktopMedia = window.matchMedia('(min-width: 1024px)');
      this.isDesktop = this.desktopMedia.matches;
      this.desktopMedia.addEventListener('change', this.onDesktopChange);
    }
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('familyId') || '';
      if (id === this.familyId) {
        return;
      }
      this.familyId = id;
      this.archiveSub?.unsubscribe();
      this.loading = true;
      this.explorer = null;
      this.available = false;
      this.people = [];
      this.selectedId = null;
      this.archiveSub = this.explorers.getArchive(id).subscribe({
        next: explorer => {
          this.loading = false;
          this.explorer = explorer;
          this.available = !!explorer && explorer.published === true;
          this.people = explorer?.people ? Object.values(explorer.people) : [];
          if (this.selectedId && !explorer?.people?.[this.selectedId]) {
            this.selectedId = null;
          }
        },
        error: () => {
          this.loading = false;
          this.available = false;
          this.explorer = null;
          this.people = [];
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.desktopMedia?.removeEventListener('change', this.onDesktopChange);
    this.routeSub?.unsubscribe();
    this.archiveSub?.unsubscribe();
  }

  private peopleRef: FamilyPerson[] | null = null;
  private branchCache: Branch[] = [];
  private coupleCache: FamilyPerson[] = [];
  private generationsCache = 0;

  private sync(): void {
    if (this.peopleRef !== this.people) {
      this.peopleRef = this.people;
      this.branchCache = buildBranches(this.people);
      this.coupleCache = findFoundingCouple(this.people);
      this.generationsCache = archiveGenerationCount(this.people);
    }
  }

  get branches(): Branch[] {
    this.sync();
    return this.branchCache;
  }

  get couple(): FamilyPerson[] {
    this.sync();
    return this.coupleCache;
  }

  get coupleNames(): string {
    return this.couple.map(personName).join(' and ');
  }

  get coupleLabel(): string {
    return this.couple.map(firstName).join(' and ');
  }

  get generations(): number {
    this.sync();
    return this.generationsCache;
  }

  select(id: string): void {
    this.selectedId = id;
  }

  clearSelection(): void {
    this.selectedId = null;
  }

  get removalRequestHref(): string {
    const title = this.explorer?.title || this.familyId;
    const subject = `Data removal request - ${title}`;
    const body = 'Please tell us your name and which details you would like removed.';
    return `mailto:eric@lecoursville.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  get drawerMode(): 'side' | 'over' {
    return this.isDesktop ? 'side' : 'over';
  }

  /** A backdrop click or Escape closes the drawer; mirror that to the selection. */
  onDrawerOpenedChange(opened: boolean): void {
    if (!opened) {
      this.clearSelection();
    }
  }

  get selected(): FamilyPerson | null {
    if (!this.selectedId || !this.explorer?.people) {
      return null;
    }
    return this.explorer.people[this.selectedId] || null;
  }

  /** The chart's branch tint for the selected person, so the panel's color bar matches. */
  private colorCache: { id: string | null; branches: Branch[]; color: string } = { id: null, branches: [], color: '' };

  get selectedBranchColor(): string {
    const id = this.selectedId;
    const branches = this.branches;
    if (this.colorCache.id === id && this.colorCache.branches === branches) {
      return this.colorCache.color;
    }
    let color = '';
    if (id) {
      const branch = branches.find(candidate => treeContainsId(candidate.tree, id, node => node.person.id, node => node.spouses.map(spouse => spouse.id)));
      color = branch ? branch.color : '';
    }
    this.colorCache = { id, branches, color };
    return color;
  }
}
