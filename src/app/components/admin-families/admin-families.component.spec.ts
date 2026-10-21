import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { Family } from 'src/app/models/family';
import { FamilyService } from 'src/app/services/family.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { AdminFamiliesComponent } from './admin-families.component';

const makeFamily = (id: number, name = `Family ${id}`): Family => ({
  id: `family-${id}`,
  name,
  hexColor: '#112233',
  sortOrder: String(id),
  createdAt: 1,
  updatedAt: 1,
});

describe('AdminFamiliesComponent', () => {
  let component: AdminFamiliesComponent;
  let fixture: ComponentFixture<AdminFamiliesComponent>;
  let familiesSource: BehaviorSubject<Family[]>;
  let familyService: {
    families$: unknown;
    createPushId: ReturnType<typeof vi.fn>;
    saveFamily: ReturnType<typeof vi.fn>;
    updateFamily: ReturnType<typeof vi.fn>;
    deleteFamily: ReturnType<typeof vi.fn>;
  };
  let confirmDialog: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    familiesSource = new BehaviorSubject<Family[]>([]);
    familyService = {
      families$: familiesSource.asObservable(),
      createPushId: vi.fn(() => 'push-id'),
      saveFamily: vi.fn(() => Promise.resolve()),
      updateFamily: vi.fn(() => Promise.resolve()),
      deleteFamily: vi.fn(() => Promise.resolve()),
    };
    confirmDialog = { confirm: vi.fn(() => Promise.resolve(false)) };

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        { provide: FamilyService, useValue: familyService },
        { provide: ConfirmDialogService, useValue: confirmDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFamiliesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const settle = (families: Family[]) => {
    familiesSource.next(families);
    fixture.detectChanges();
  };

  it('validates a new family before saving it', async () => {
    component.onAdd();
    component.onSave();
    expect(component.formError).toBe('Name is required');
    expect(familyService.saveFamily).not.toHaveBeenCalled();

    component.formData = { id: 'A', name: 'Smith', hexColor: 'nope' };
    component.onSave();
    expect(component.formError).toBe('Hex color must be in format #RRGGBB');

    component.formData.hexColor = '#112233';
    component.onSave();
    await Promise.resolve();

    expect(familyService.createPushId).toHaveBeenCalled();
    expect(familyService.saveFamily).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Smith', hexColor: '#112233', sortOrder: 'A' }),
    );
  });

  it('validates an edited family and updates it', async () => {
    const family = makeFamily(1, 'Mignonne');
    settle([family]);

    component.onEdit(family);
    component.formData.name = '   ';
    component.onSave();
    expect(component.formError).toBe('Name is required');
    expect(familyService.updateFamily).not.toHaveBeenCalled();

    component.formData.name = 'Mignonne Updated';
    component.onSave();
    await Promise.resolve();

    expect(familyService.updateFamily).toHaveBeenCalledWith(
      family.id,
      expect.objectContaining({ name: 'Mignonne Updated' }),
    );
  });

  it('keeps the family when the delete confirmation is cancelled', async () => {
    const family = makeFamily(1, 'Mignonne');
    settle([family]);

    await component.onDelete(family);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Delete family Mignonne? This cannot be undone.' }),
    );
    expect(familyService.deleteFamily).not.toHaveBeenCalled();
  });

  it('deletes the family when the confirmation is accepted', async () => {
    const family = makeFamily(1, 'Mignonne');
    settle([family]);
    confirmDialog.confirm.mockResolvedValue(true);

    await component.onDelete(family);

    expect(familyService.deleteFamily).toHaveBeenCalledWith(family.id);
  });

  it('paginates the family list 10 rows at a time', () => {
    settle(Array.from({ length: 12 }, (_, i) => makeFamily(i + 1)));

    expect(component.familyPageData.items).toHaveLength(10);
    expect(component.familyShowingRange).toBe('Showing 1-10 of 12');

    component.nextFamilyPage();
    fixture.detectChanges();

    expect(component.familyPageData.items).toHaveLength(2);
    expect(component.familyShowingRange).toBe('Showing 11-12 of 12');
  });

  it('renders CSV header errors instead of returning to the empty list', () => {
    (component as any).parseCsv('Name,ID\nSmith,1');
    fixture.detectChanges();

    expect(component.isCsvPreview).toBe(true);
    expect(component.csvErrors.join(' ')).toContain('Color_Hex');
    expect(fixture.nativeElement.querySelector('.csv-errors[role="alert"]').textContent).toContain('Color_Hex');
  });

  it('counts only valid rows and pluralizes the import label', () => {
    const rows = [
      'Smith,fam-1,#112233',
      ',fam-2,#112233',
    ];
    (component as any).parseCsv(['Name,ID,Color_Hex', ...rows].join('\n'));
    fixture.detectChanges();

    expect(component.validCsvCount).toBe(1);
    const button = fixture.nativeElement.querySelector('.csv-actions button:last-child');
    expect(button.textContent).toContain('Import 1 family');

    const many = Array.from({ length: 12 }, (_, i) => `Family ${i + 1},fam-${i + 1},#112233`);
    (component as any).parseCsv(['Name,ID,Color_Hex', ...many].join('\n'));
    fixture.detectChanges();
    expect(component.validCsvCount).toBe(12);
    expect(fixture.nativeElement.querySelector('.csv-actions button:last-child').textContent)
      .toContain('Import 12 families');
  });

  it('keeps the preview and shows an alert when a CSV write fails', async () => {
    familyService.saveFamily.mockReturnValue(Promise.reject(new Error('boom')));
    (component as any).parseCsv(['Name,ID,Color_Hex', 'Smith,fam-1,#112233'].join('\n'));

    await component.onCsvConfirm();
    fixture.detectChanges();

    expect(component.csvPreview).toHaveLength(1);
    expect(component.csvErrors).toEqual([]);
    expect(component.importError).toContain('boom');
    expect(fixture.nativeElement.querySelector('.import-error[role="alert"]').textContent).toContain('boom');
    expect(fixture.nativeElement.querySelector('.csv-actions button:last-child').disabled).toBe(false);
  });

  it('limits the CSV preview to 10 rows per page', () => {
    const rows = Array.from({ length: 12 }, (_, i) => `fam-${i + 1},Family ${i + 1},#112233`);
    (component as any).parseCsv(['Name,ID,Color_Hex', ...rows].join('\n'));

    expect(component.csvPreview).toHaveLength(12);
    expect(component.csvPageData.items).toHaveLength(10);
    expect(component.csvShowingRange).toBe('Showing 1-10 of 12');

    component.nextCsvPage();
    expect(component.csvPageData.items).toHaveLength(2);
  });
});
