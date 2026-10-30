import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TestSharedModule } from '../../../test-shared.module';
import { AdminFamilyExplorerComponent } from './admin-family-explorer.component';
import { FamilyExplorerService } from 'src/app/services/family-explorer.service';
import { RtdbService } from 'src/app/services/rtdb.service';
import { NoResultsMessageComponent } from '../no-results-message/no-results-message.component';
import { PageToolbarComponent } from '../shared/page-toolbar/page-toolbar.component';

describe('AdminFamilyExplorerComponent', () => {
  let fixture: ComponentFixture<AdminFamilyExplorerComponent>;
  let component: AdminFamilyExplorerComponent;
  let listArchives: ReturnType<typeof vi.fn>;
  let ingest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listArchives = vi.fn();
    ingest = vi.fn().mockResolvedValue({ count: 1 });
    await TestBed.configureTestingModule({
      imports: [TestSharedModule, NoResultsMessageComponent, PageToolbarComponent],
      declarations: [AdminFamilyExplorerComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: FamilyExplorerService, useValue: { listArchives, ingest } },
        { provide: RtdbService, useValue: {} },
      ],
    }).compileComponents();
  });

  function create(): void {
    fixture = TestBed.createComponent(AdminFamilyExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('announces loading with a hidden status while archives load', () => {
    listArchives.mockReturnValue(new Subject());
    create();

    const status = fixture.nativeElement.querySelector('.visually-hidden[role="status"]') as HTMLElement;
    expect(status?.textContent).toContain('Loading archives');
  });

  it('surfaces an error banner when listing archives fails', () => {
    listArchives.mockReturnValue(throwError(() => new Error('permission_denied')));
    create();

    expect(component.loading).toBe(false);
    expect(component.actionError).toBe('Could not load the archives.');
    expect(fixture.nativeElement.querySelector('.admin-error')?.textContent).toContain('Could not load the archives.');
  });

  it('renders a row per listed archive', () => {
    listArchives.mockReturnValue(of({ ferland: { title: 'Ferland Family', published: true } }));
    create();

    expect(component.loading).toBe(false);
    expect(component.rows).toEqual([{ id: 'ferland', title: 'Ferland Family', published: true, updatedAt: undefined }]);
  });

  it('re-ingesting an existing family keeps that row\u2019s current published state', async () => {
    listArchives.mockReturnValue(of({ ferland: { title: 'Ferland Family', published: true } }));
    create();

    component.familyId = 'ferland';
    component.title = 'Ferland Family';
    const rawJson = '{"people":[{"id":"p1","name":"P"}]}';
    component.rawJson = rawJson;
    await component.onConfirm();

    expect(ingest).toHaveBeenCalledWith('ferland', 'Ferland Family', true, rawJson);
  });

  it('prefills the published checkbox from a matching archive row when the family id changes', () => {
    listArchives.mockReturnValue(of({ ferland: { title: 'Ferland Family', published: true } }));
    create();
    expect(component.published).toBe(false);

    component.familyId = 'ferland';
    component.onFamilyIdInput();

    expect(component.published).toBe(true);
  });
});
