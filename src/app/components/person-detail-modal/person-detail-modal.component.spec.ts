import { ComponentFixture, TestBed } from '@angular/core/testing';
import { defer, of } from 'rxjs';
import { Router } from '@angular/router';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { PeopleService } from 'src/app/services/people.service';
import { CalendarService } from 'src/app/services/calendar.service';
import { ClanService } from 'src/app/services/clan.service';
import { Person } from 'src/app/models/person';
import { PersonDetailModalComponent } from './person-detail-modal.component';

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    name: {
      firstGiven: 'Edith',
      firstPreferred: 'Edith',
      maiden: null,
      last: 'Evans',
      suffix: null,
    },
    clanId: null,
    birthday: { year: 1935, month: 1, day: 10 },
    spouseId: null,
    anniversaryDate: null,
    deathDate: null,
    emails: [{ address: 'edith@example.com', label: null }],
    phones: [{ label: 'Home', number: '555-0101' }],
    addresses: [{
      id: null,
      full: 'Edith Evans',
      street: '1 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      label: 'Home',
    }],
    directDescendent: false,
    generationNumber: 2,
    parentIds: [],
    lineage: null,
    isLiving: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('PersonDetailModalComponent', () => {
  let component: PersonDetailModalComponent;
  let fixture: ComponentFixture<PersonDetailModalComponent>;
  let currentPerson: Person;

  const renderPerson = (person: Person): void => {
    currentPerson = person;
    component.personId = person.id;
    fixture.detectChanges();
  };

  const rows = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.detail-row'));
  const rowWithLabel = (label: string): HTMLElement | undefined =>
    rows().find(row => row.querySelector('.label')?.textContent?.trim() === label);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        {
          provide: PeopleService,
          useValue: {
            people$: defer(() => of(currentPerson ? [currentPerson] : [])),
            getPerson: () => of(currentPerson),
          },
        },
        {
          provide: CalendarService,
          useValue: { getEventsByPerson: () => of([]) },
        },
        {
          provide: ClanService,
          useValue: { clans$: of([]) },
        },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonDetailModalComponent);
    component = fixture.componentInstance;
  });

  it('renders no Contact card for a deceased person with address data', () => {
    renderPerson(makePerson({ isLiving: false }));

    expect(fixture.nativeElement.querySelector('app-contact-info')).toBeFalsy();
    expect(fixture.nativeElement.textContent).not.toContain('Contact');
  });

  it('renders a Died row with the formatted date for a deceased person with a death date', () => {
    renderPerson(makePerson({
      isLiving: false,
      deathDate: { year: 2015, month: 6, day: 15 },
    }));

    const died = rowWithLabel('Died');
    expect(died).toBeTruthy();
    expect(died!.textContent).toContain('June 15, 2015');
  });

  it('renders no Died row and no placeholder for a deceased person without a death date', () => {
    renderPerson(makePerson({ isLiving: false, deathDate: null }));

    expect(rowWithLabel('Died')).toBeUndefined();
    expect(fixture.nativeElement.textContent).not.toContain('Died');
  });

  it('still renders the Contact card for a living person with contact data', () => {
    renderPerson(makePerson({ isLiving: true }));

    expect(fixture.nativeElement.querySelector('app-contact-info')).toBeTruthy();
  });

  it('computes age at death from the death date', () => {
    renderPerson(makePerson({
      birthday: { year: 1935, month: 1, day: 10 },
      deathDate: { year: 2015, month: 6, day: 15 },
      isLiving: false,
    }));

    expect(component.calculateAge()).toBe('80');
  });

  it('computes living age against today', () => {
    const today = new Date();
    renderPerson(makePerson({
      birthday: {
        year: today.getFullYear() - 30,
        month: today.getMonth() + 1,
        day: Math.min(today.getDate(), 28),
      },
      deathDate: null,
      isLiving: true,
    }));

    expect(component.calculateAge()).toBe('30');
  });

  it('treats a missing isLiving value as living', () => {
    const person = makePerson();
    delete (person as Partial<Person>).isLiving;
    renderPerson(person);

    expect(fixture.nativeElement.querySelector('app-contact-info')).toBeTruthy();
  });
});
