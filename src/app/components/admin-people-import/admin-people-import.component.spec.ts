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
    deleteClan: ReturnType<typeof vi.fn>;
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
      deleteClan: vi.fn(() => Promise.resolve()),
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

  it('keeps preview read-only and creates drafted clans only on confirm', async () => {
    peopleService.importPeople.mockReturnValue(of({ created: 1, updated: 0, inactive: 0, conflicts: [] }));

    component.parseCSV([CSV_HEADERS, CSV_ROW].join('\n'));
    fixture.detectChanges();

    expect(clanService.saveClan).not.toHaveBeenCalled();
    expect(component.parsedPeople[0].person.clanId).toBe('p-1');

    component.confirmImport();
    await Promise.resolve();
    await Promise.resolve();

    expect(clanService.saveClan).toHaveBeenCalledTimes(1);
    expect(clanService.saveClan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', name: 'Mignonne' }),
    );
    expect(peopleService.importPeople).toHaveBeenCalledTimes(1);
  });

  it('rolls back drafted clans when the people write fails', async () => {
    peopleService.importPeople.mockReturnValue(throwError(() => new Error('boom')));
    component.parseCSV([CSV_HEADERS, CSV_ROW].join('\n'));
    fixture.detectChanges();

    component.confirmImport();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(clanService.saveClan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', name: 'Mignonne' }),
    );
    expect(clanService.deleteClan).toHaveBeenCalledWith('p-1');
    expect(component.importError).toBe('Import failed: boom');
  });

  it('re-drafts a clan after cancel so confirm writes it before the people', async () => {
    peopleService.importPeople.mockReturnValue(of({ created: 1, updated: 0, inactive: 0, conflicts: [] }));
    clanService.saveClan.mockReturnValue(Promise.resolve());

    component.parseCSV([CSV_HEADERS, CSV_ROW].join('\n'));
    component.cancelImport();

    component.parseCSV([CSV_HEADERS, CSV_ROW].join('\n'));
    fixture.detectChanges();

    component.confirmImport();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(clanService.saveClan).toHaveBeenCalledTimes(1);
    const savedClan = clanService.saveClan.mock.calls[0][0];
    const importedPeople = peopleService.importPeople.mock.calls[0][0];
    expect(importedPeople[0].clanId).toBe(savedClan.id);
    expect(clanService.saveClan.mock.invocationCallOrder[0]).toBeLessThan(
      peopleService.importPeople.mock.invocationCallOrder[0],
    );
  });

  it('surfaces rows skipped for a missing ID in the preview summary', () => {
    component.parseCSV([
      CSV_HEADERS,
      CSV_ROW,
      ',Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 Main,Mignonne',
    ].join('\n'));
    fixture.detectChanges();

    expect(component.skippedMissingId).toBe(1);
    expect(component.skippedSummary).toBe('1 row skipped: missing ID');
    expect(
      fixture.nativeElement.querySelector('[data-testid="import-skipped"]').textContent,
    ).toContain('1 row skipped: missing ID');
  });

  it('disables Confirm while the preview has errors', () => {
    component.parseCSV([CSV_HEADERS, CSV_ROW, 'bad,row'].join('\n'));
    fixture.detectChanges();

    expect(component.validationErrors.length).toBeGreaterThan(0);
    expect(
      fixture.nativeElement.querySelector('[data-testid="import-confirm"]').disabled,
    ).toBe(true);

    component.confirmImport();
    expect(peopleService.importPeople).not.toHaveBeenCalled();
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
