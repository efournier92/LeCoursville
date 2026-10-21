import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Family } from 'src/app/models/family';
import { FamilyService } from 'src/app/services/family.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { paginate, Page, pageRange } from 'src/app/admin/pagination';

interface ParsedFamily {
  id: string;
  name: string;
  hexColor: string;
  sortOrder: string;
  errors: string[];
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
  families: Family[] = [];
  editingFamily: Family | null = null;
  isAdding = false;
  formData = { id: '', name: '', hexColor: '#000000' };
  formError = '';
  actionError = '';
  csvPreview: ParsedFamily[] = [];
  csvErrors: string[] = [];
  importError = '';
  isCsvPreview = false;
  selectedFileName: string | null = null;

  state: FamiliesState = 'loading';
  readonly pageSize = 10;
  familyPage = 1;
  csvPage = 1;

  private familiesSubscription?: Subscription;

  constructor(
    private familyService: FamilyService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadFamilies();
  }

  ngOnDestroy(): void {
    this.familiesSubscription?.unsubscribe();
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
    this.state = 'loading';
    this.familiesSubscription = this.familyService.families$.subscribe({
      next: (families: Family[]) => {
        this.families = families || [];
        this.familyPage = Math.min(this.familyPage, this.familyPageData.pageCount);
        this.state = 'ready';
      },
      error: () => {
        this.state = 'error';
      },
    });
  }

  // FAMILY FORM

  onAdd(): void {
    this.isAdding = true;
    this.editingFamily = null;
    this.formData = { id: '', name: '', hexColor: '#000000' };
    this.formError = '';
  }

  onEdit(family: Family): void {
    this.editingFamily = family;
    this.isAdding = false;
    this.formData = { id: family.sortOrder, name: family.name, hexColor: family.hexColor };
    this.formError = '';
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
    const sortOrder = this.formData.id.trim();

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
    this.formData = { id: '', name: '', hexColor: '#000000' };
    this.formError = '';
  }

  // CSV IMPORT

  onCsvFileSelected(event: Event): void {
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
      const familyId = this.getValue(values, headerMap, 'ID').trim();
      const sortOrder = familyId;
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

      this.csvPreview.push({ id: familyId, name, hexColor: hexColor || '#808080', sortOrder, errors });
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
    const families: Family[] = [];

    for (const parsed of validFamilies) {
      const exists = this.families.some(f => f.name.toLowerCase() === parsed.name.toLowerCase());
      if (exists) continue;

      families.push({
        id: parsed.id || this.familyService.createPushId(),
        name: parsed.name,
        hexColor: parsed.hexColor,
        sortOrder: parsed.sortOrder,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    this.actionError = '';
    this.importError = '';
    try {
      await Promise.all(families.map(family => this.familyService.saveFamily(family)));
      this.onCsvCancel();
    } catch (error) {
      this.importError = this.writeFailure('import families', error);
    }
  }

  onCsvCancel(): void {
    this.csvPreview = [];
    this.csvErrors = [];
    this.importError = '';
    this.isCsvPreview = false;
    this.selectedFileName = null;
    this.csvPage = 1;
  }

  private writeFailure(action: string, error: unknown): string {
    const message = (error as Error)?.message || 'Unknown error';
    return `Could not ${action}: ${message}`;
  }
}
