import { Component, OnInit } from '@angular/core';
import { Family } from 'src/app/models/family';
import { FamilyService } from 'src/app/services/family.service';

interface ParsedFamily {
  id: string;
  name: string;
  hexColor: string;
  sortOrder: string;
  errors: string[];
}

@Component({
  selector: 'app-admin-families',
  templateUrl: './admin-families.component.html',
  styleUrls: ['./admin-families.component.scss']
})
export class AdminFamiliesComponent implements OnInit {
  families: Family[] = [];
  editingFamily: Family | null = null;
  isAdding = false;
  formData = { id: '', name: '', hexColor: '#000000' };
  formError = '';
  csvPreview: ParsedFamily[] = [];
  csvErrors: string[] = [];
  isCsvPreview = false;
  selectedFileName: string | null = null;

  constructor(private familyService: FamilyService) {}

  ngOnInit(): void {
    this.familyService.families$.subscribe(families => {
      this.families = families;
    });
  }

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

  onDelete(id: string): void {
    this.familyService.deleteFamily(id);
  }

  onSave(): void {
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

    if (this.isAdding) {
      const family: Family = {
        id: this.familyService.createPushId(),
        name,
        hexColor,
        sortOrder,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.familyService.saveFamily(family).then(() => {
        this.onCancel();
      });
    } else if (this.editingFamily) {
      this.familyService.updateFamily(this.editingFamily.id, {
        name,
        hexColor,
        sortOrder,
        updatedAt: Date.now()
      }).then(() => {
        this.onCancel();
      });
    }
  }

  onCancel(): void {
    this.isAdding = false;
    this.editingFamily = null;
    this.formData = { id: '', name: '', hexColor: '#000000' };
    this.formError = '';
  }

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
    this.csvPreview = [];

    const lines = rawCsv.trim().split('\n');
    if (lines.length < 2) {
      this.csvErrors.push('CSV must have header and at least one data row');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const headerMap = this.buildHeaderMap(headers);

    if (headerMap['Name'] === undefined) {
      this.csvErrors.push('CSV must have a "Name" column');
      return;
    }

    if (headerMap['Color_Hex'] === undefined) {
      this.csvErrors.push('CSV must have a "Color_Hex" column');
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

    this.isCsvPreview = this.csvPreview.length > 0;
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

  onCsvConfirm(): void {
    const validFamilies = this.csvPreview.filter(c => c.errors.length === 0);

    for (const parsed of validFamilies) {
      const exists = this.families.some(f => f.name.toLowerCase() === parsed.name.toLowerCase());
      if (exists) continue;

      const family: Family = {
        id: parsed.id || this.familyService.createPushId(),
        name: parsed.name,
        hexColor: parsed.hexColor,
        sortOrder: parsed.sortOrder,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.familyService.saveFamily(family);
    }

    this.csvPreview = [];
    this.csvErrors = [];
    this.isCsvPreview = false;
  }

  onCsvCancel(): void {
    this.csvPreview = [];
    this.csvErrors = [];
    this.isCsvPreview = false;
    this.selectedFileName = null;
  }
}