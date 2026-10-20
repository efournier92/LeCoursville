import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { PeopleService, ImportResult } from 'src/app/services/people.service';
import { ClanService } from 'src/app/services/clan.service';
import { Person } from 'src/app/models/person';
import { AdminPeopleImportComponent } from './admin-people-import.component';

const CSV_HEADERS = 'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Address_Street,Family';
const CSV_ROW = 'p-1,Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 Main,Mignonne';

describe('AdminPeopleImportComponent', () => {
  let component: AdminPeopleImportComponent;
  let fixture: ComponentFixture<AdminPeopleImportComponent>;
  let peopleService: { importPeople: ReturnType<typeof vi.fn> };
  let clanService: {
    clans$: unknown;
    createPushId: ReturnType<typeof vi.fn>;
    saveClan: ReturnType<typeof vi.fn>;
  };

  const parsedPerson = (): any => ({
    person: {
      id: 'p-1',
      name: { firstGiven: 'Zoe', last: 'Zimmerman' },
      birthday: { year: 1990, month: 1, day: 15 },
      addresses: [],
    } as unknown as Person,
    errors: [],
    warnings: [],
  });

  const readyToImport = () => {
    component.parsedPeople = [parsedPerson()];
    component.hasParsedFile = true;
    component.importPreview = { total: 1, created: 1, updated: 0, inactive: 0 };
    fixture.detectChanges();
  };

  beforeEach(async () => {
    peopleService = { importPeople: vi.fn() };
    clanService = {
      clans$: of([]),
      createPushId: vi.fn(() => 'clan-push'),
      saveClan: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        { provide: PeopleService, useValue: peopleService },
        { provide: ClanService, useValue: clanService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPeopleImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('maps CSV rows into the parsed preview and counts', () => {
    component.parseCSV([CSV_HEADERS, CSV_ROW].join('\n'));
    fixture.detectChanges();

    expect(component.parsedPeople).toHaveLength(1);
    expect(component.parsedPeople[0].person.name.firstGiven).toBe('Zoe');
    expect(component.parsedPeople[0].person.name.last).toBe('Zimmerman');
    expect(component.parsedPeople[0].person.clanId).toBe('p-1');
    expect(component.importPreview).toEqual({ total: 1, created: 1, updated: 0, inactive: 0 });
  });

  it('renders the empty state when a file yields no parsed rows', () => {
    component.parseCSV([
      CSV_HEADERS,
      ',Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 Main,Mignonne',
    ].join('\n'));
    fixture.detectChanges();

    expect(component.parsedPeople).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('app-no-results-message')).toBeTruthy();
  });

  it('calls the import service once and shows the busy state while it runs', () => {
    const result$ = new Subject<ImportResult>();
    peopleService.importPeople.mockReturnValue(result$);
    readyToImport();

    component.confirmImport();
    component.confirmImport();
    fixture.detectChanges();

    expect(peopleService.importPeople).toHaveBeenCalledTimes(1);
    expect(component.isImporting).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="import-progress"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="import-confirm"]').disabled,
    ).toBe(true);

    result$.next({ created: 1, updated: 0, inactive: 0, conflicts: [] });
    result$.complete();
    fixture.detectChanges();

    expect(component.isImporting).toBe(false);
    expect(component.importResult).toEqual({ created: 1, updated: 0, inactive: 0, conflicts: [] });
    expect(component.parsedPeople).toHaveLength(0);
  });

  it('renders the import error and keeps the preview so it can be retried', () => {
    peopleService.importPeople.mockReturnValue(throwError(() => new Error('boom')));
    readyToImport();

    component.confirmImport();
    fixture.detectChanges();

    expect(peopleService.importPeople).toHaveBeenCalledTimes(1);
    expect(component.importResult).toBeNull();
    expect(component.parsedPeople).toHaveLength(1);
    expect(component.importError).toBe('Import failed: boom');
    expect(fixture.nativeElement.querySelector('app-load-error')).toBeTruthy();
  });
});
