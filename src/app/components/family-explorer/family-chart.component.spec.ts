import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestSharedModule } from '../../../test-shared.module';
import { FamilyExplorerModule } from './family-explorer.module';
import { FamilyChartComponent } from './family-chart.component';
import { FamilyPerson } from 'src/app/services/family-explorer.service';

function person(overrides: Partial<FamilyPerson> & { id: string }): FamilyPerson {
  return { given: overrides.id, surname: 'Fern', ...overrides };
}

function samplePeople(): FamilyPerson[] {
  return [
    person({ id: 'a', given: 'Adam', sex: 'M', birthDate: '1900', spouseIds: ['b'] }),
    person({ id: 'b', given: 'Beth', sex: 'F', birthDate: '1902', spouseIds: ['a'] }),
    person({ id: 'c1', given: 'Carl', birthDate: '1920', fatherId: 'a', motherId: 'b', spouseIds: ['x'] }),
    person({ id: 'x', given: 'Xena', birthDate: '1922', spouseIds: ['c1'] }),
    person({ id: 'd1', given: 'Dora', birthDate: '1945', fatherId: 'c1' }),
    person({ id: 'c2', given: 'Cora', birthDate: '1930', fatherId: 'a', motherId: 'b' }),
    person({ id: 'd3', given: 'Drew', birthDate: '1955', fatherId: 'c2' }),
    person({ id: 'e', given: 'Eve', surname: 'Oak', birthDate: '1910', spouseIds: ['s'] }),
    person({ id: 's', given: 'Sam', surname: 'Oak', birthDate: '1911', spouseIds: ['e'] }),
  ];
}

describe('FamilyChartComponent', () => {
  let fixture: ComponentFixture<FamilyChartComponent>;
  let component: FamilyChartComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestSharedModule, FamilyExplorerModule],
    }).compileComponents();
    fixture = TestBed.createComponent(FamilyChartComponent);
    component = fixture.componentInstance;
  });

  function render(search = ''): void {
    fixture.componentRef.setInput('people', samplePeople());
    fixture.componentRef.setInput('search', search);
    fixture.detectChanges();
  }

  function branchIds(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.family-branch'))
      .map((node: Element) => node.getAttribute('data-testid') || '');
  }

  it('renders branches in head birth order', () => {
    render();
    expect(branchIds()).toEqual(['family-branch-e', 'family-branch-c1', 'family-branch-c2']);
    expect(fixture.nativeElement.querySelector('.family-head-name')?.textContent).toContain("Eve's Family");
  });

  it('keeps a branch whose descendant matches the search', () => {
    render('drew');
    expect(branchIds()).toEqual(['family-branch-c2']);
    expect(fixture.nativeElement.querySelector('[data-testid="family-unit-d3"]')).not.toBeNull();
  });

  it('restores every branch when the search clears', () => {
    render('drew');
    expect(branchIds()).toHaveLength(1);

    fixture.componentRef.setInput('search', '');
    fixture.detectChanges();
    expect(branchIds()).toEqual(['family-branch-e', 'family-branch-c1', 'family-branch-c2']);
  });

  it('renders the numeral row, tint dot, and family label before the head name', () => {
    render();

    const branch = fixture.nativeElement.querySelector('[data-testid="family-branch-e"]') as HTMLElement;
    expect(branch.querySelector('[data-testid="family-numeral"]')?.textContent).toContain('01');
    expect(branch.querySelector('[data-testid="family-tint-dot"]')).not.toBeNull();
    expect(branch.querySelector('.branch-family')?.textContent).toContain('Oak Branch');

    const numeral = branch.querySelector('.branch-numeral-row') as HTMLElement;
    const head = branch.querySelector('.family-head-name') as HTMLElement;
    expect(numeral.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('announces the matching branch count while searching', () => {
    render('drew');

    const status = fixture.nativeElement.querySelector('[data-testid="family-search-status"]') as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toContain('1 matching branch');
  });
});
