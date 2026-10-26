import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

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
  let loadedSource: BehaviorSubject<boolean>;
  let familiesStatusSource: BehaviorSubject<FamiliesStatus>;

  beforeEach(async () => {
    const peopleSource = new BehaviorSubject<Person[]>([]);
    const familiesSource = new BehaviorSubject<Family[]>([]);
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
});
