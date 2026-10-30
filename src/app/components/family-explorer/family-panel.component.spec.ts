import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestSharedModule } from '../../../test-shared.module';
import { FamilyExplorerModule } from './family-explorer.module';
import { FamilyPanelComponent } from './family-panel.component';
import { FamilyPerson } from 'src/app/services/family-explorer.service';

function person(overrides: Partial<FamilyPerson> & { id: string }): FamilyPerson {
  return { given: overrides.id, surname: 'Fern', ...overrides };
}

function samplePeople(): Record<string, FamilyPerson> {
  const list = [
    person({ id: 'dad', given: 'David', surname: 'Fern', sex: 'M' }),
    person({ id: 'mom', given: 'Mona', surname: 'Fern', sex: 'F' }),
    person({ id: 'me', given: 'Mia', surname: 'Fern', sex: 'F', birthDate: '1950-01-05', deathDate: '2020-06-07', fatherId: 'dad', motherId: 'mom', spouseIds: ['sp'], marriageYears: { sp: 1975 } }),
    person({ id: 'sp', given: 'Stan', surname: 'Reed', sex: 'M', spouseIds: ['me'] }),
    person({ id: 'kid', given: 'Kai', surname: 'Fern', birthDate: '1975-03-02', fatherId: 'sp', motherId: 'me' }),
  ];
  return Object.fromEntries(list.map(entry => [entry.id, entry]));
}

describe('FamilyPanelComponent', () => {
  let fixture: ComponentFixture<FamilyPanelComponent>;
  let component: FamilyPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestSharedModule, FamilyExplorerModule],
    }).compileComponents();
    fixture = TestBed.createComponent(FamilyPanelComponent);
    component = fixture.componentInstance;
  });

  function render(): void {
    const people = samplePeople();
    fixture.componentRef.setInput('people', people);
    fixture.componentRef.setInput('person', people['me']);
    fixture.detectChanges();
  }

  it('renders the name and vital years', () => {
    render();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.family-panel-name')?.textContent).toContain('Mia Fern');
    expect(root.querySelector('.p-years')?.textContent).toContain('1950\u20132020');
    expect(root.querySelector('[data-testid="family-panel-birth"]')?.textContent).toContain('January 5, 1950');
  });

  it('builds lineage with wrapped ancestors and descendants', () => {
    render();
    const names = Array.from(fixture.nativeElement.querySelectorAll('.person-name'))
      .map((node: Element) => node.textContent?.trim());
    expect(names.some(name => name?.includes('David'))).toBe(true);
    expect(names.some(name => name?.includes('Mona'))).toBe(true);
    expect(names.some(name => name?.includes('Kai'))).toBe(true);
  });

  it('renders lineage from an explicit name when no parts exist', () => {
    const people: Record<string, FamilyPerson> = { solo: { id: 'solo', name: 'Tessa Transplant' } };
    fixture.componentRef.setInput('people', people);
    fixture.componentRef.setInput('person', people['solo']);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const heading = root.querySelector('.family-panel-name')?.textContent?.trim();
    const lineage: HTMLElement | null = root.querySelector('[data-testid="family-panel-lineage"]');
    expect(heading).toBe('Tessa Transplant');
    expect(lineage?.querySelector('.person-name')?.textContent?.trim()).toBe('Tessa Transplant');
  });

  it('includes children declared only through parent childIds', () => {
    const people: Record<string, FamilyPerson> = Object.fromEntries([
      person({ id: 'dad', given: 'David', surname: 'Fern', sex: 'M', childIds: ['k1', 'k2'] }),
      person({ id: 'k1', given: 'Kim', surname: 'Fern' }),
      person({ id: 'k2', given: 'Kit', surname: 'Fern' }),
    ].map(entry => [entry.id, entry]));
    fixture.componentRef.setInput('people', people);
    fixture.componentRef.setInput('person', people['dad']);
    fixture.detectChanges();

    const names = Array.from(fixture.nativeElement.querySelectorAll('.person-name'))
      .map((node: Element) => node.textContent?.trim());
    expect(names.some(name => name?.includes('Kim'))).toBe(true);
    expect(names.some(name => name?.includes('Kit'))).toBe(true);
  });

  it('orders children by parsed birth year, undated last', () => {
    const people: Record<string, FamilyPerson> = Object.fromEntries([
      person({ id: 'dad', given: 'David', surname: 'Fern', sex: 'M', childIds: ['und', 'bea', 'abe'] }),
      person({ id: 'abe', given: 'Abe', surname: 'Fern', birthDate: 'ABT 1901' }),
      person({ id: 'bea', given: 'Bea', surname: 'Fern', birthDate: '1902-03-04' }),
      person({ id: 'und', given: 'Una', surname: 'Fern' }),
    ].map(entry => [entry.id, entry]));
    fixture.componentRef.setInput('people', people);
    fixture.componentRef.setInput('person', people['dad']);
    fixture.detectChanges();

    const names = Array.from(fixture.nativeElement.querySelectorAll('.person-name'))
      .map((node: Element) => node.textContent?.trim());
    expect(names.indexOf('Abe Fern')).toBeGreaterThan(names.indexOf('David Fern'));
    expect(names.indexOf('Bea Fern')).toBeGreaterThan(names.indexOf('Abe Fern'));
    expect(names.indexOf('Una Fern')).toBeGreaterThan(names.indexOf('Bea Fern'));
  });

  it('emits select when a spouse is clicked', () => {
    const emitted: string[] = [];
    component.select.subscribe((id: string) => emitted.push(id));
    render();

    (fixture.nativeElement.querySelector('.spouse-row .link') as HTMLElement).click();
    expect(emitted).toEqual(['sp']);
  });

  it('emits close on Escape', () => {
    let closed = 0;
    component.close.subscribe(() => closed++);
    render();

    const panel = fixture.nativeElement.querySelector('.family-panel') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(1);
  });
});
