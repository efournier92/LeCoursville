import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TestSharedModule } from '../../../test-shared.module';
import { FamilyExplorerModule } from './family-explorer.module';
import { FamilyExplorerComponent } from './family-explorer.component';
import { FamilyExplorer, FamilyExplorerService, FamilyPerson } from 'src/app/services/family-explorer.service';

function person(overrides: Partial<FamilyPerson> & { id: string }): FamilyPerson {
  return { given: overrides.id, surname: 'Fern', ...overrides };
}

function archive(people: FamilyPerson[], title = 'The Ferns'): FamilyExplorer {
  return {
    title,
    published: true,
    people: Object.fromEntries(people.map(entry => [entry.id, entry])),
  };
}

describe('FamilyExplorerComponent', () => {
  let fixture: ComponentFixture<FamilyExplorerComponent>;
  let component: FamilyExplorerComponent;
  let getArchive: ReturnType<typeof vi.fn>;
  let paramMap: BehaviorSubject<ParamMap>;
  const originalMatchMedia = window.matchMedia;

  function stubDesktop(matches: boolean): void {
    window.matchMedia = vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }

  beforeEach(async () => {
    getArchive = vi.fn();
    paramMap = new BehaviorSubject(convertToParamMap({ familyId: 'ferns' }));
    await TestBed.configureTestingModule({
      imports: [TestSharedModule, FamilyExplorerModule],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: paramMap.asObservable() } },
        { provide: FamilyExplorerService, useValue: { getArchive } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function create(): void {
    fixture = TestBed.createComponent(FamilyExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('clears the loading state when the archive read is denied', () => {
    getArchive.mockReturnValue(throwError(() => new Error('permission_denied')));
    stubDesktop(true);
    create();

    expect(component.loading).toBe(false);
    expect(component.available).toBe(false);
    expect(component.explorer).toBeNull();
    expect(component.people).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="family-explorer-empty"]')).not.toBeNull();
  });

  it('uses a side drawer at desktop widths', () => {
    getArchive.mockReturnValue(of(null));
    stubDesktop(true);
    create();
    expect(component.drawerMode).toBe('side');
  });

  it('uses an overlay drawer below 1024px', () => {
    getArchive.mockReturnValue(of(null));
    stubDesktop(false);
    create();
    expect(component.drawerMode).toBe('over');
  });

  it('renders the roots row for a single founder', () => {
    getArchive.mockReturnValue(of(archive([person({ id: 'a', given: 'Adam', sex: 'M', birthDate: '1900' })])));
    stubDesktop(true);
    create();

    const row = fixture.nativeElement.querySelector('[data-testid="family-roots"]') as HTMLElement;
    expect(row).not.toBeNull();
    const button = row.querySelector('[data-testid="family-root-a"]') as HTMLElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Adam Fern');
    expect(button.textContent).toContain('1900');
  });

  it('pluralizes the subtitle and counts the whole archive', () => {
    getArchive.mockReturnValue(of(archive([person({ id: 'a', given: 'Adam' }), person({ id: 'b', given: 'Beth' })])));
    stubDesktop(true);
    create();

    expect(fixture.nativeElement.querySelector('[data-testid="family-counts"]')?.textContent).toContain('2 People · 1 Generation');
  });

  it('announces loading with a hidden status while the archive loads', () => {
    getArchive.mockReturnValue(new Subject());
    stubDesktop(true);
    create();

    const status = fixture.nativeElement.querySelector('.visually-hidden[role="status"]') as HTMLElement;
    expect(status?.textContent).toContain('Loading the family tree');
  });

  it('counts the founders generation in a couple-shaped archive', () => {
    getArchive.mockReturnValue(of(archive([
      person({ id: 'fa-1', given: 'Fred', sex: 'M', spouseIds: ['fa-2'], childIds: ['fa-3'] }),
      person({ id: 'fa-2', given: 'Flo', sex: 'F', spouseIds: ['fa-1'] }),
      person({ id: 'fa-3', given: 'Gail', fatherId: 'fa-1', motherId: 'fa-2', childIds: ['fa-4'] }),
      person({ id: 'fa-4', given: 'Hana', fatherId: 'fa-3', childIds: ['fa-5'] }),
      person({ id: 'fa-5', given: 'Ivo', fatherId: 'fa-4' }),
    ])));
    stubDesktop(true);
    create();

    expect(fixture.nativeElement.querySelector('[data-testid="family-counts"]')?.textContent).toContain('5 People · 4 Generations');
  });

  it('re-loads and resets state when the route family id changes', () => {
    getArchive.mockReturnValue(of(archive([person({ id: 'a', given: 'Adam' })])));
    stubDesktop(true);
    create();
    component.select('a');
    fixture.detectChanges();
    expect(component.familyId).toBe('ferns');

    getArchive.mockReturnValue(of(archive([person({ id: 'z', given: 'Zoe' })], 'The Wolves')));
    paramMap.next(convertToParamMap({ familyId: 'wolf' }));
    fixture.detectChanges();

    expect(component.familyId).toBe('wolf');
    expect(getArchive).toHaveBeenLastCalledWith('wolf');
    expect(component.loading).toBe(false);
    expect(component.selectedId).toBeNull();
    expect(component.people.map(entry => entry.id)).toEqual(['z']);
    expect(component.explorer?.title).toBe('The Wolves');
    expect(fixture.nativeElement.querySelector('.topbar-title')?.textContent).toContain('The Wolves');
  });
});
