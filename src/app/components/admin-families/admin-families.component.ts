import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Family } from 'src/app/models/family';
import { FamilyService } from 'src/app/services/family.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { paginate, Page, pageRange } from 'src/app/admin/pagination';

interface ParsedFamily {
  sortOrder: string;
  name: string;
  hexColor: string;
  errors: string[];
}

interface ImportSummary {
  imported: number;
  skipped: number;
}

type FamiliesState = 'loading' | 'ready' | 'error';

@Component({
    selector: 'app-admin-families',
    templateUrl: './admin-families.component.html',
    styleUrls: ['./admin-families.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminFamiliesComponent implements OnInit, OnDestroy {
  @ViewChild('sortOrderInput') sortOrderInput?: ElementRef<HTMLInputElement>;

  families: Family[] = [];
  editingFamily: Family | null = null;
  isAdding = false;
  formData = { sortOrder: '', name: '', hexColor: '#000000' };
  formError = '';
  actionError = '';
  csvPreview: ParsedFamily[] = [];
  csvErrors: string[] = [];
  importError = '';
  importSummary: ImportSummary | null = null;
  isCsvPreview = false;
  selectedFileName: string | null = null;

  state: FamiliesState = 'loading';
  readonly pageSize = 10;
  familyPage = 1;
  csvPage = 1;

  private familiesSubscription?: Subscription;
  private familiesStatusSubscription?: Subscription;

  constructor(
    private familyService: FamilyService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadFamilies();
  }

  ngOnDestroy(): void {
    this.familiesSubscription?.unsubscribe();
    this.familiesStatusSubscription?.unsubscribe();
  }

  // PAGE STATE

  get familyPageData(): Page<Family> {
    return paginate(this.families, this.familyPage, this.pageSize);
  }

  get csvPageData(): Page<ParsedFamily> {
    return paginate(this.csvPreview, this.csvPage, this.pageSize);
  }

  get familyShowingRange(): string {
    return pageRange(this.familyPageData);
  }

  get csvShowingRange(): string {
    return pageRange(this.csvPageData);
  }

  get importSummaryMessage(): string {
    if (!this.importSummary) {
      return '';
    }
    const { imported, skipped } = this.importSummary;
    const importedLabel = imported === 1 ? 'family' : 'families';
    if (skipped === 0) {
      return `Imported ${imported} ${importedLabel}.`;
    }
    const skippedLabel = skipped === 1 ? 'duplicate' : 'duplicates';
    return `Imported ${imported} ${importedLabel}, skipped ${skipped} ${skippedLabel}.`;
  }

  get validCsvCount(): number {
    return this.csvPreview.filter(family => family.errors.length === 0).length;
  }

  retry(): void {
    this.loadFamilies();
  }

  previousFamilyPage(): void {
    this.familyPage = Math.max(1, this.familyPage - 1);
  }

  nextFamilyPage(): void {
    this.familyPage = Math.min(this.familyPageData.pageCount, this.familyPage + 1);
  }

  previousCsvPage(): void {
    this.csvPage = Math.max(1, this.csvPage - 1);
  }

  nextCsvPage(): void {
    this.csvPage = Math.min(this.csvPageData.pageCount, this.csvPage + 1);
  }

  private loadFamilies(): void {
    this.familiesSubscription?.unsubscribe();
    this.familiesStatusSubscription?.unsubscribe();
    this.familiesSubscription = this.familyService.families$.subscribe((families: Family[]) => {
      this.families = families || [];
      this.familyPage = Math.min(this.familyPage, this.familyPageData.pageCount);
    });
    this.familiesStatusSubscription = this.familyService.familiesStatus$?.subscribe((status) => {
      this.state = status;
    });
  }

  // FAMILY FORM

  onAdd(): void {
    this.isAdding = true;
    this.editingFamily = null;
    this.formData = { sortOrder: '', name: '', hexColor: '#000000' };
    this.formError = '';
    this.focusFormStart();
  }

  onEdit(family: Family): void {
    this.editingFamily = family;
    this.isAdding = false;
    this.formData = { sortOrder: family.sortOrder, name: family.name, hexColor: family.hexColor };
    this.formError = '';
    this.focusFormStart();
  }

  async onDelete(family: Family): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete family?',
      message: `Delete family ${family.name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.actionError = '';
    try {
      await this.familyService.deleteFamily(family.id);
    } catch (error) {
      this.actionError = this.writeFailure('delete the family', error);
    }
  }

  async onSave(): Promise<void> {
    const name = this.formData.name.trim();
    const hexColor = this.formData.hexColor.trim();
    const sortOrder = this.formData.sortOrder.trim();

    if (!name) {
      this.formError = 'Name is required';
      return;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
      this.formError = 'Hex color must be in format #RRGGBB';
      return;
    }

    this.formError = '';
    this.actionError = '';

    try {
      if (this.isAdding) {
        const family: Family = {
          id: this.familyService.createPushId(),
          name,
          hexColor,
          sortOrder,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await this.familyService.saveFamily(family);
        this.onCancel();
      } else if (this.editingFamily) {
        await this.familyService.updateFamily(this.editingFamily.id, {
          name,
          hexColor,
          sortOrder,
          updatedAt: Date.now()
        });
        this.onCancel();
      }
    } catch (error) {
      this.actionError = this.writeFailure('save the family', error);
    }
  }

  onCancel(): void {
    this.isAdding = false;
    this.editingFamily = null;
    this.formData = { sortOrder: '', name: '', hexColor: '#000000' };
    this.formError = '';
  }

  // CSV IMPORT

  onCsvFileSelected(event: Event): void {
    if (this.state !== 'ready') {
      return;
    }
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    this.selectedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      this.parseCsv(content);
    };
    reader.readAsText(file);
  }

  private parseCsv(rawCsv: string): void {
    this.csvErrors = [];
    this.importError = '';
    this.importSummary = null;
    this.csvPreview = [];
    this.csvPage = 1;
    this.isCsvPreview = false;

    const lines = rawCsv.trim().split('\n');
    if (lines.length < 2) {
      this.csvErrors.push('CSV must have header and at least one data row');
      this.isCsvPreview = true;
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const headerMap = this.buildHeaderMap(headers);

    if (headerMap['Name'] === undefined) {
      this.csvErrors.push('CSV must have a "Name" column');
      this.isCsvPreview = true;
      return;
    }

    if (headerMap['Color_Hex'] === undefined) {
      this.csvErrors.push('CSV must have a "Color_Hex" column');
      this.isCsvPreview = true;
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        this.csvErrors.push(`Row ${i + 1}: Column count mismatch`);
        continue;
      }

      const name = this.getValue(values, headerMap, 'Name').trim();
      const hexColor = this.getValue(values, headerMap, 'Color_Hex').trim();
      const sortOrder = this.getValue(values, headerMap, 'ID').trim();
      const errors: string[] = [];

      if (!name) {
        errors.push(`Row ${i + 1}: Name is required`);
      }

      if (hexColor && !/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
        errors.push(`Row ${i + 1}: Invalid hex color '${hexColor}'`);
      }

      if (!hexColor) {
        errors.push(`Row ${i + 1}: Color_Hex is required`);
      }

      this.csvPreview.push({ sortOrder, name, hexColor: hexColor || '#808080', errors });
      if (errors.length > 0) {
        this.csvErrors.push(...errors);
      }
    }

    this.isCsvPreview = this.csvPreview.length > 0 || this.csvErrors.length > 0;
  }

  private buildHeaderMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    headers.forEach((h, idx) => {
      map[h] = idx;
    });
    return map;
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  private getValue(values: string[], headerMap: Record<string, number>, key: string): string {
    const idx = headerMap[key];
    return idx !== undefined ? values[idx] || '' : '';
  }

  async onCsvConfirm(): Promise<void> {
    const validFamilies = this.csvPreview.filter(c => c.errors.length === 0);
    const knownNames = new Set(this.families.map(f => f.name.toLowerCase()));
    const toCreate: Family[] = [];
    let skipped = 0;

    for (const parsed of validFamilies) {
      const key = parsed.name.toLowerCase();
      if (knownNames.has(key)) {
        skipped++;
        continue;
      }
      knownNames.add(key);
      toCreate.push({
        id: this.familyService.createPushId(),
        name: parsed.name,
        hexColor: parsed.hexColor,
        sortOrder: parsed.sortOrder,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    this.actionError = '';
    this.importError = '';
    const results = await Promise.allSettled(
      toCreate.map(family => this.familyService.saveFamily(family)),
    );
    const failedNames = new Set<string>();
    let imported = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        imported++;
      } else {
        failedNames.add(toCreate[index].name.toLowerCase());
      }
    });
    this.importSummary = { imported, skipped };

    if (failedNames.size > 0) {
      // Keep only the failed rows so a retry does not re-create committed ones.
      this.csvPreview = this.csvPreview.filter(parsed => failedNames.has(parsed.name.toLowerCase()));
      this.csvPage = 1;
      this.importError = `Could not import ${failedNames.size} ${failedNames.size === 1 ? 'family' : 'families'}. Retry to try again.`;
      return;
    }

    this.resetPreview();
  }

  onCsvCancel(): void {
    this.resetPreview();
    this.importSummary = null;
  }

  private resetPreview(): void {
    this.csvPreview = [];
    this.csvErrors = [];
    this.importError = '';
    this.isCsvPreview = false;
    this.selectedFileName = null;
    this.csvPage = 1;
  }

  private focusFormStart(): void {
    // The Add button is removed when the form opens, so focus must land on the
    // first field instead of being lost; the timeout waits for the form view.
    setTimeout(() => {
      const field = this.sortOrderInput?.nativeElement;
      if (!field) { return; }
      field.scrollIntoView({ block: 'center' });
      field.focus();
    });
  }

  private writeFailure(action: string, error: unknown): string {
    const message = (error as Error)?.message || 'Unknown error';
    return `Could not ${action}: ${message}`;
  }
}
