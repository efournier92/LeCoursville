import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { Person } from 'src/app/models/person';
import { Family } from 'src/app/models/family';
import { PeopleService } from 'src/app/services/people.service';
import { FamiliesStatus, FamilyService } from 'src/app/services/family.service';
import { PeopleComponent } from './people.component';

describe('PeopleComponent', () => {
  let component: PeopleComponent;
  let fixture: ComponentFixture<PeopleComponent>;
  let peopleSource: BehaviorSubject<Person[]>;
  let familiesSource: BehaviorSubject<Family[]>;
  let loadedSource: BehaviorSubject<boolean>;
  let familiesStatusSource: BehaviorSubject<FamiliesStatus>;

  beforeEach(async () => {
    peopleSource = new BehaviorSubject<Person[]>([]);
    familiesSource = new BehaviorSubject<Family[]>([]);
    loadedSource = new BehaviorSubject<boolean>(false);
    familiesStatusSource = new BehaviorSubject<FamiliesStatus>('loading');

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        {
          provide: PeopleService,
          useValue: { people$: peopleSource.asObservable(), peopleLoaded$: loadedSource.asObservable() },
        },
        {
          provide: FamilyService,
          useValue: { families$: familiesSource.asObservable(), familiesStatus$: familiesStatusSource.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PeopleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the families error state without a skeleton', () => {
    loadedSource.next(true);
    familiesStatusSource.next('error');
    fixture.detectChanges();

    expect(component.status).toBe('error');
    expect(fixture.nativeElement.querySelector('app-load-error')?.textContent)
      .toContain("We couldn't load the family tree.");
    expect(fixture.nativeElement.querySelector('.skeleton-state')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain("We couldn't find any people.");
  });

  it('stays loading until both data sources resolve', () => {
    expect(component.status).toBe('loading');

    loadedSource.next(true);
    fixture.detectChanges();
    expect(component.status).toBe('loading');

    familiesStatusSource.next('ready');
    fixture.detectChanges();
    expect(component.status).toBe('ready');
    expect(fixture.nativeElement.querySelector('.skeleton-state')).toBeNull();
  });

  it('renders the roots through the shared person tree', () => {
    const person: Person = {
      id: 'p2',
      name: { firstGiven: null, firstPreferred: 'Root', maiden: null, last: 'Person', suffix: null },
      familyId: 'f1',
      birthday: { year: 1900, month: 1, day: 1 },
      spouseId: null,
      anniversaryDate: null,
      deathDate: null,
      emails: [],
      phones: [],
      addresses: [],
      directDescendent: false,
      generationNumber: 2,
      parentIds: [],
      lineage: null,
      isLiving: true,
      createdAt: 0,
      updatedAt: 0,
    };
    const family: Family = {
      id: 'f1', name: 'Tree', hexColor: '#111111', sortOrder: 'Tree', createdAt: 0, updatedAt: 0,
    };

    peopleSource.next([person]);
    familiesSource.next([family]);
    loadedSource.next(true);
    familiesStatusSource.next('ready');
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('app-person-tree .person-name')?.textContent).toContain('Root Person');
    expect(root.querySelector('app-person-tree .tree-row')).not.toBeNull();
    expect(root.querySelector('.family-group')).not.toBeNull();
  });

  it('exposes first-generation spans as keyboard-activated buttons', () => {
    const person: Person = {
      id: 'g1',
      name: { firstGiven: null, firstPreferred: 'First', maiden: null, last: 'Gen', suffix: null },
      familyId: 'f1',
      birthday: null,
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
    };
    const spouse: Person = { ...person, id: 'g1-S', name: { ...person.name, firstPreferred: 'Fran', last: 'Gen' } };
    const family: Family = {
      id: 'f1', name: 'Tree', hexColor: '#111111', sortOrder: 'Tree', createdAt: 0, updatedAt: 0,
    };

    peopleSource.next([person, spouse]);
    familiesSource.next([family]);
    loadedSource.next(true);
    familiesStatusSource.next('ready');
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const spans = Array.from(fixture.nativeElement.querySelectorAll('.first-generation-row .first-gen-person')) as HTMLElement[];
    expect(spans).toHaveLength(2);
    for (const span of spans) {
      expect(span.getAttribute('role')).toBe('button');
      expect(span.getAttribute('tabindex')).toBe('0');
    }

    spans[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { selected: 'g1-S' },
      queryParamsHandling: 'merge',
    }));
  });
});
