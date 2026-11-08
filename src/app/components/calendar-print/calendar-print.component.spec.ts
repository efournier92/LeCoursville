import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { LvLoadErrorComponent } from '../load-error/load-error.component';
import { PageToolbarComponent } from '../shared/page-toolbar/page-toolbar.component';
import { CalendarPrintComponent } from './calendar-print.component';
import { PeopleService } from 'src/app/services/people.service';
import { AuthService } from 'src/app/services/auth.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { Person } from 'src/app/models/person';

describe('CalendarPrintComponent', () => {
  let component: CalendarPrintComponent;
  let fixture: ComponentFixture<CalendarPrintComponent>;
  let peopleSubject: BehaviorSubject<Person[]>;
  let loadedSubject: BehaviorSubject<boolean>;
  let loadErrorSubject: BehaviorSubject<string | null>;
  let retryPeopleSubject: BehaviorSubject<Person[]>;
  let userSubject: BehaviorSubject<any>;
  let getPeopleSpy: jasmine.Spy;

  const person: Person = {
    id: 'p1',
    name: { firstGiven: 'Alice', firstPreferred: null, maiden: null, last: 'Anderson', suffix: null },
    familyId: null,
    birthday: { year: 1996, month: 3, day: 14 },
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

  beforeEach(() => {
    peopleSubject = new BehaviorSubject<Person[]>([]);
    loadedSubject = new BehaviorSubject<boolean>(false);
    loadErrorSubject = new BehaviorSubject<string | null>(null);
    retryPeopleSubject = new BehaviorSubject<Person[]>([]);
    userSubject = new BehaviorSubject<any>(null);
    getPeopleSpy = jasmine.createSpy('getPeople').and.returnValue({
      valueChanges: () => retryPeopleSubject.asObservable(),
    });

    const mockPeopleService = {
      people$: peopleSubject.asObservable(),
      peopleLoaded$: loadedSubject.asObservable(),
      loadError$: loadErrorSubject.asObservable(),
      getPeople: getPeopleSpy,
    };
    const mockAuthService = {
      userObservable: userSubject.asObservable(),
    };
    const mockAnalyticsService = jasmine.createSpyObj('AnalyticsService', ['logEvent']);
    const mockRoute = {
      snapshot: { queryParamMap: convertToParamMap({}) },
    };

    TestBed.configureTestingModule({
      imports: [TestSharedModule, LvLoadErrorComponent, PageToolbarComponent],
      declarations: [CalendarPrintComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: PeopleService, useValue: mockPeopleService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarPrintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps Print disabled and avoids a page count while people load', () => {
    expect(component.status).toBe('loading');
    expect(component.printDisabled).toBe(true);
    expect(component.statusText).toBe('Loading calendar…');
    expect(fixture.nativeElement.querySelector('.calendar-print-skeleton')).not.toBeNull();
  });

  it('enables Print and reports the page count once data loads', () => {
    peopleSubject.next([person]);
    loadedSubject.next(true);
    fixture.detectChanges();

    expect(component.printDisabled).toBe(false);
    expect(component.status).toBe('ready');
    expect(component.statusText).toBe('12 pages');
  });

  it('reaches the error state from the load error stream', () => {
    loadErrorSubject.next('permission denied');
    fixture.detectChanges();

    expect(component.status).toBe('error');
    expect(component.printDisabled).toBe(true);
    expect(fixture.nativeElement.querySelector('app-load-error')).not.toBeNull();
  });

  it('retries through the available fresh people stream', () => {
    loadErrorSubject.next('permission denied');
    fixture.detectChanges();

    component.retry();
    retryPeopleSubject.next([person]);
    fixture.detectChanges();

    expect(getPeopleSpy).toHaveBeenCalled();
    expect(component.status).toBe('ready');
    expect(component.printDisabled).toBe(false);
  });

  it('applies all saved prefs after the async user arrives', () => {
    userSubject.next({
      id: 'u1',
      prefs: {
        calendar: {
          showBirthdays: false,
          showAnniversaries: false,
          showNotLiving: true,
          showHolidays: false,
        },
      },
    });
    fixture.detectChanges();

    expect(component.options.includeBirthdays).toBe(false);
    expect(component.options.includeAnniversaries).toBe(false);
    expect(component.options.includeDeceased).toBe(true);
    expect(component.options.includeHolidays).toBe(false);
  });

  it('clears the preview when the year is out of range', () => {
    peopleSubject.next([person]);
    loadedSubject.next(true);
    fixture.detectChanges();
    expect(component.pages.length).toBe(12);

    component.options.year = 1800;
    component.onOptionsChange();
    fixture.detectChanges();

    expect(component.yearError).not.toBe('');
    expect(component.pages.length).toBe(0);
    expect(component.overflowWarnings.length).toBe(0);
    expect(component.printDisabled).toBe(true);
    expect(component.statusText).toBe('Enter a year between 1900 and 2100.');
  });
});
