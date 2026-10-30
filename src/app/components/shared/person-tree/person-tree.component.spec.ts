import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedModule } from '../shared.module';
import { Person } from 'src/app/models/person';
import { PersonNode, PersonTreeComponent } from './person-tree.component';

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    name: { firstGiven: null, firstPreferred: null, maiden: null, last: null, suffix: null },
    familyId: null,
    birthday: { year: 1900, month: 1, day: 1 },
    spouseId: null,
    anniversaryDate: null,
    deathDate: null,
    emails: [],
    phones: [],
    addresses: [],
    directDescendent: false,
    generationNumber: 1,
    parentIds: [],
    lineage: null,
    isLiving: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeNode(person: Person, spouse: Person | null = null, children: PersonNode[] = []): PersonNode {
  return { person, spouse, children, level: 0 };
}

describe('PersonTreeComponent', () => {
  let fixture: ComponentFixture<PersonTreeComponent>;
  let component: PersonTreeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SharedModule] }).compileComponents();
    fixture = TestBed.createComponent(PersonTreeComponent);
    component = fixture.componentInstance;
  });

  function render(nodes: PersonNode[]): void {
    component.nodes = nodes;
    fixture.detectChanges();
  }

  it('renders modal defaults: names and spouse with no deceased class', () => {
    const person = makePerson({
      id: 'p1',
      name: { firstGiven: null, firstPreferred: 'John', maiden: null, last: 'Smith', suffix: null },
      isLiving: false,
    });
    const spouse = makePerson({
      id: 'p1-S',
      name: { firstGiven: null, firstPreferred: 'Jane', maiden: null, last: 'Doe', suffix: null },
    });

    render([makeNode(person, spouse)]);

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.person-name')?.textContent).toContain('John Smith');
    expect(root.textContent).toContain('Jane Doe');
    expect(root.querySelector('.spouse-separator')).not.toBeNull();
    expect(root.querySelector('.deceased')).toBeNull();
  });

  it('applies the deceased class only for the people variant', () => {
    component.variant = 'people';
    component.deceasedStyle = true;
    render([makeNode(makePerson({
      id: 'p1',
      name: { firstGiven: null, firstPreferred: 'John', maiden: null, last: 'Smith', suffix: null },
      isLiving: false,
    }))]);

    const name: HTMLElement = fixture.nativeElement.querySelector('.person-name');
    expect(name.classList.contains('deceased')).toBe(true);
  });

  it('dedupes the spouse surname when spouseSurnameDedupe is set', () => {
    component.spouseSurnameDedupe = true;
    render([makeNode(
      makePerson({
        id: 'p1',
        name: { firstGiven: null, firstPreferred: 'John', maiden: null, last: 'Smith', suffix: null },
      }),
      makePerson({
        id: 'p1-S',
        name: { firstGiven: null, firstPreferred: 'Jane', maiden: null, last: 'Smith', suffix: null },
      }),
    )]);

    const names = fixture.nativeElement.querySelectorAll('.person-name');
    expect(names[0].textContent?.trim()).toBe('John');
    expect(names[1].textContent?.trim()).toBe('Jane Smith');
  });

  it('omits firstGiven when preferGivenFallback is false', () => {
    component.preferGivenFallback = false;
    render([makeNode(makePerson({
      id: 'p1',
      name: { firstGiven: 'John', firstPreferred: null, maiden: null, last: 'Smith', suffix: null },
    }))]);

    const text = fixture.nativeElement.querySelector('.person-name').textContent;
    expect(text).not.toContain('John');
    expect(text).toContain('Smith');
  });

  it('uses colorForNode for the generation bar', () => {
    component.colorForNode = () => 'rgb(1, 2, 3)';
    render([makeNode(makePerson({ id: 'p1' }), null, [
      makeNode(makePerson({ id: 'p2' })),
    ])]);

    const bar: HTMLElement = fixture.nativeElement.querySelector('.generation-bar');
    expect(bar.style.backgroundColor).toBe('rgb(1, 2, 3)');
  });

  it('emits personClick with the clicked person id', () => {
    const emitted: string[] = [];
    component.personClick.subscribe((id: string) => emitted.push(id));
    render([makeNode(makePerson({ id: 'p1' }))]);

    (fixture.nativeElement.querySelector('.person-name') as HTMLElement).click();

    expect(emitted).toEqual(['p1']);
  });

  it('marks the selected person', () => {
    component.selectedPersonId = 'p1';
    render([makeNode(makePerson({ id: 'p1' }))]);

    const name: HTMLElement = fixture.nativeElement.querySelector('.person-name');
    expect(name.classList.contains('selected')).toBe(true);
  });

  it('sets aria-pressed on the matching span when a selection is bound', () => {
    component.selectedPersonId = 'p1';
    render([makeNode(
      makePerson({ id: 'p1' }),
      makePerson({ id: 'p1-S', name: { firstGiven: null, firstPreferred: 'Jane', maiden: null, last: 'Doe', suffix: null } }),
    )]);

    const names = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.person-name');
    expect(names[0].getAttribute('aria-pressed')).toBe('true');
    expect(names[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('sets aria-pressed on the spouse span when the spouse is selected', () => {
    component.selectedPersonId = 'p1-S';
    render([makeNode(
      makePerson({ id: 'p1' }),
      makePerson({ id: 'p1-S', name: { firstGiven: null, firstPreferred: 'Jane', maiden: null, last: 'Doe', suffix: null } }),
    )]);

    const names = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.person-name');
    expect(names[0].getAttribute('aria-pressed')).toBe('false');
    expect(names[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('omits aria-pressed when no selection is bound', () => {
    render([makeNode(makePerson({ id: 'p1' }))]);

    const name: HTMLElement = fixture.nativeElement.querySelector('.person-name');
    expect(name.getAttribute('aria-pressed')).toBeNull();
  });

  it('exposes clickable names as keyboard buttons', () => {
    render([makeNode(
      makePerson({ id: 'p1' }),
      makePerson({ id: 'p1-S', name: { firstGiven: null, firstPreferred: 'Jane', maiden: null, last: 'Doe', suffix: null } }),
    )]);

    const names = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.person-name');
    names.forEach((name) => {
      expect(name.getAttribute('role')).toBe('button');
      expect(name.getAttribute('tabindex')).toBe('0');
    });
  });

  it('emits personClick on Enter for the blood name', () => {
    const emitted: string[] = [];
    component.personClick.subscribe((id: string) => emitted.push(id));
    render([makeNode(makePerson({ id: 'p1' }))]);

    const name: HTMLElement = fixture.nativeElement.querySelector('.person-name');
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitted).toEqual(['p1']);
  });

  it('emits the spouse id on Enter for the spouse name', () => {
    const emitted: string[] = [];
    component.personClick.subscribe((id: string) => emitted.push(id));
    render([makeNode(makePerson({ id: 'p1' }), makePerson({ id: 'p1-S', name: { firstGiven: null, firstPreferred: 'Jane', maiden: null, last: 'Doe', suffix: null } }))]);

    const names = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.person-name');
    names[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitted).toEqual(['p1-S']);
  });

  it('omits role and tabindex when not clickable', () => {
    component.clickable = false;
    render([makeNode(makePerson({ id: 'p1' }))]);

    const name: HTMLElement = fixture.nativeElement.querySelector('.person-name');
    expect(name.getAttribute('role')).toBeNull();
    expect(name.getAttribute('tabindex')).toBeNull();
  });

  it('dedupes the spouse surname by default', () => {
    expect(component.spouseSurnameDedupe).toBe(true);
    render([makeNode(
      makePerson({
        id: 'p1',
        name: { firstGiven: null, firstPreferred: 'John', maiden: null, last: 'Smith', suffix: null },
      }),
      makePerson({
        id: 'p1-S',
        name: { firstGiven: null, firstPreferred: 'Jane', maiden: null, last: 'Smith', suffix: null },
      }),
    )]);

    const names = fixture.nativeElement.querySelectorAll('.person-name');
    expect(names[0].textContent?.trim()).toBe('John');
    expect(names[1].textContent?.trim()).toBe('Jane Smith');
  });
});
