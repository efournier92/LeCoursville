import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestSharedModule } from '../../../test-shared.module';
import { FamilyExplorerModule } from './family-explorer.module';
import { FamilyTreeNodeComponent } from './family-tree-node.component';
import { FamilyPerson } from 'src/app/services/family-explorer.service';
import { TreeNode } from './family-tree.model';

function person(overrides: Partial<FamilyPerson> & { id: string }): FamilyPerson {
  return { given: overrides.id, surname: 'Fern', ...overrides };
}

function node(personOverrides: Partial<FamilyPerson> & { id: string }, children: TreeNode[] = [], spouses: FamilyPerson[] = []): TreeNode {
  return { person: person(personOverrides), spouses, children };
}

describe('FamilyTreeNodeComponent', () => {
  let fixture: ComponentFixture<FamilyTreeNodeComponent>;
  let component: FamilyTreeNodeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestSharedModule, FamilyExplorerModule],
    }).compileComponents();
    fixture = TestBed.createComponent(FamilyTreeNodeComponent);
    component = fixture.componentInstance;
  });

  it('renders the blood name and spouse separator', () => {
    component.node = node({ id: 'p1', given: 'John', surname: 'Smith' }, [], [person({ id: 'p1-s', given: 'Jane', surname: 'Doe' })]);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="family-unit-p1"]')?.textContent).toContain('John Smith');
    expect(root.querySelector('[data-testid="family-spouse-p1-s"]')?.textContent).toContain('Jane Doe');
    expect(root.querySelector('.spouse-separator')).not.toBeNull();
  });

  it('adds the deceased class from deathDate', () => {
    component.node = node({ id: 'p1', given: 'John', surname: 'Smith', deathDate: '1970-01-01' });
    fixture.detectChanges();

    const name = fixture.nativeElement.querySelector('[data-testid="family-unit-p1"] .nm') as HTMLElement;
    expect(name.classList.contains('deceased')).toBe(true);
  });

  it('exposes the depth on the node unit', () => {
    component.depth = 3;
    component.node = node({ id: 'p1' });
    fixture.detectChanges();

    const unit = fixture.nativeElement.querySelector('[data-testid="family-node-p1"]') as HTMLElement;
    expect(unit.getAttribute('data-depth')).toBe('3');
  });

  it('renders the guide only when there are visible children', () => {
    component.node = node({ id: 'p1' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="family-guide"]')).toBeNull();

    component.node = node({ id: 'p1' }, [node({ id: 'c1' })]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="family-guide"]')).not.toBeNull();
  });

  it('emits select with the clicked person id', () => {
    const emitted: string[] = [];
    component.select.subscribe((id: string) => emitted.push(id));
    component.node = node({ id: 'p1', given: 'John', surname: 'Smith' });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="family-unit-p1"]') as HTMLElement).click();
    expect(emitted).toEqual(['p1']);
  });

  it('hides non-matching children while keeping a branch with a matching descendant', () => {
    component.node = node({ id: 'root' }, [
      node({ id: 'keep', given: 'Zed' }, [node({ id: 'deep', given: 'Faron' })]),
      node({ id: 'drop', given: 'Bob' }),
    ]);
    component.search = 'faron';
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="family-node-deep"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="family-node-keep"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="family-node-drop"]')).toBeNull();
  });

  it('renders a child tick only below the branch head', () => {
    component.node = node({ id: 'p1' }, [node({ id: 'c1' })]);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const p1 = root.querySelector('[data-testid="family-node-p1"]') as HTMLElement;
    expect(p1.querySelector('[data-testid="family-tick"]')).toBeNull();
    const child = root.querySelector('[data-testid="family-node-c1"]') as HTMLElement;
    expect(child.querySelector('[data-testid="family-tick"]')).not.toBeNull();
  });

  it('renders a generation divider before the children with a label and count', () => {
    component.node = node({ id: 'p1' }, [node({ id: 'c1' }), node({ id: 'c2' })]);
    fixture.detectChanges();

    const divider = fixture.nativeElement.querySelector('[data-testid="gen-divider"]') as HTMLElement;
    expect(divider).not.toBeNull();
    expect(divider.querySelector('.gen-label')?.textContent).toContain('Children');
    expect(divider.querySelector('.gen-count')?.textContent).toContain('2');
  });

  it('labels deeper generation dividers', () => {
    expect(component.generationLabel(1)).toBe('Grandchildren');
    expect(component.generationLabel(2)).toBe('Great-Grandchildren');
    expect(component.generationLabel(3)).toBe('Descendants');
  });

  it('renders a marriage year chip for the unit and its spouses', () => {
    component.node = node(
      { id: 'p1', given: 'John', marriageYears: { s1: 1975 } },
      [],
      [person({ id: 's1', given: 'Jane', marriageYears: { p1: 1975 } })],
    );
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('[data-testid^="family-marriage-"]');
    expect(chips).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[data-testid="family-marriage-p1-s1"]')?.textContent).toContain('1975');
  });

  it('renders exactly one chip for a symmetric marriage pair', () => {
    component.node = node(
      { id: 'p', given: 'John', marriageYears: { s1: 1948 } },
      [],
      [person({ id: 's1', given: 'Jane', marriageYears: { p: 1948 } })],
    );
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.mchip');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('1948');
  });

  it('marks the pinned spouse as pressed and the unit as pinned', () => {
    component.selectedId = 's1';
    component.node = node({ id: 'p1' }, [], [person({ id: 's1' })]);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="family-spouse-s1"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-testid="family-node-p1"]')?.classList.contains('pinned')).toBe(true);
  });
});
