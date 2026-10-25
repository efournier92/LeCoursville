import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { PeopleService, ImportResult } from 'src/app/services/people.service';
import { FamilyService } from 'src/app/services/family.service';
import { Family } from 'src/app/models/family';
import { Person, PersonDate, Email, Phone } from 'src/app/models/person';
import { Address } from 'src/app/models/address';
import { paginate, Page, pageRange } from 'src/app/admin/pagination';

interface ParsedPerson {
  person: Person;
  errors: string[];
  warnings: string[];
}

@Component({
    selector: 'app-admin-people-import',
    templateUrl: './admin-people-import.component.html',
    styleUrls: ['./admin-people-import.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminPeopleImportComponent implements OnInit, OnDestroy {
  parsedPeople: ParsedPerson[] = [];
  validationErrors: string[] = [];
  validationWarnings: string[] = [];
  importPreview: { total: number; created: number; updated: number; inactive: number } | null = null;
  lastImportTimestamp: string | null = null;
  isImporting = false;
  importResult: ImportResult | null = null;
  importError: string | null = null;
  selectedFileName: string | null = null;
  hasParsedFile = false;
  skippedMissingId = 0;
  peopleReady = false;
  isDragOver = false;
  private lastImportSkipped = 0;
  private lastImportErrors = 0;
  private existingPeople: Person[] = [];
  private pendingFamilies: Map<string, Family> = new Map();
  private peopleSub?: Subscription;

  // Pagination
  readonly previewPageSize = 10;
  previewPage = 1;

  constructor(
    private peopleService: PeopleService,
    private familyService: FamilyService
  ) {}

  ngOnInit(): void {
    this.peopleSub = combineLatest([this.peopleService.people$, this.peopleService.peopleLoaded$])
      .subscribe(([people, loaded]) => {
        this.existingPeople = people;
        this.peopleReady = loaded;
        this.recomputePreview();
      });
  }

  ngOnDestroy(): void {
    this.peopleSub?.unsubscribe();
  }

  parseCSV(rawCsv: string): void {
    this.validationErrors = [];
    this.validationWarnings = [];
    this.parsedPeople = [];
    this.importPreview = null;
    this.importError = null;
    this.importResult = null;
    this.hasParsedFile = true;
    this.previewPage = 1;
    this.skippedMissingId = 0;
    this.pendingFamilies.clear();

    const lines = rawCsv.trim().split('\n');
    if (lines.length < 2) {
      this.validationErrors.push('CSV must have header and at least one data row');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const headerMap = this.buildHeaderMap(headers);

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        this.validationErrors.push(`Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
        continue;
      }

      const idIndex = headerMap['ID'];
      if (idIndex !== undefined && (!values[idIndex] || values[idIndex].trim() === '')) {
        this.skippedMissingId++;
        continue;
      }

      const parsed = this.parseRow(values, headerMap, i + 1);
      if (parsed.errors.length > 0) {
        this.validationErrors.push(...parsed.errors);
      }
      if (parsed.warnings.length > 0) {
        this.validationWarnings.push(...parsed.warnings);
      }
      if (!parsed.errors.some(e => e.toLowerCase().includes('name is required'))) {
        this.parsedPeople.push(parsed);
      }
    }

    if (this.parsedPeople.length > 0) {
      this.resolveSpouses();
      this.computeParentIds();
    }
    this.recomputePreview();
  }

  private recomputePreview(): void {
    if (this.parsedPeople.length === 0) {
      this.importPreview = null;
      return;
    }
    const existingIds = new Set(this.existingPeople.map(p => p.id));
    const updated = this.parsedPeople.filter(p => existingIds.has(p.person.id)).length;
    this.importPreview = {
      total: this.parsedPeople.length,
      created: this.parsedPeople.length - updated,
      updated,
      inactive: 0
    };
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

  private parseRow(values: string[], headerMap: Record<string, number>, rowNum: number): ParsedPerson {
    const errors: string[] = [];
    const warnings: string[] = [];

    const birthdayResult = this.parseDate(this.getValue(values, headerMap, 'Birthday'), rowNum);
    if (birthdayResult.warning) {
      warnings.push(`Row ${rowNum}: ${birthdayResult.warning}`);
    }

    const anniversaryResult = this.parseDateNullable(this.getValue(values, headerMap, 'Anniversary'), rowNum);
    if (anniversaryResult.warning) {
      warnings.push(`Row ${rowNum}: ${anniversaryResult.warning}`);
    }

    const deathResult = this.parseDate(this.getValue(values, headerMap, 'Died'), rowNum, 'Died');
    if (deathResult.warning) {
      warnings.push(`Row ${rowNum}: ${deathResult.warning}`);
    }
    if (birthdayResult.date && deathResult.date && this.isBefore(deathResult.date, birthdayResult.date)) {
      warnings.push(
        `Row ${rowNum}: Death date ${deathResult.date.year}-${String(deathResult.date.month).padStart(2, '0')}-${String(deathResult.date.day).padStart(2, '0')} is before Birthday; imported with the death date`
      );
    }

    const colorHex = this.getNullable(values, headerMap, 'Color_Hex');
    if (colorHex && !/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
      warnings.push(`Row ${rowNum}: Color Hex '${colorHex}' is not a valid hex color`);
    }

    const generationNumResult = this.parseGenerationNumber(this.getValue(values, headerMap, 'Generation_Number'), rowNum);

    const isLivingValue = this.getValue(values, headerMap, 'Living?');
    let isLiving = true;
    if (isLivingValue) {
      isLiving = isLivingValue === 'TRUE';
    }

    const addressStreet = this.getValue(values, headerMap, 'Address_Street');
    const addressCity = this.getNullable(values, headerMap, 'Address_City');
    const addressState = this.getNullable(values, headerMap, 'Address_State');
    const addressZip = this.getNullable(values, headerMap, 'Address_Zip');
    const addressFull = this.getNullable(values, headerMap, 'Address_Full');

    const person: Person = {
      id: this.getValue(values, headerMap, 'ID'),
      name: {
        firstGiven: this.getNullable(values, headerMap, 'Name_First_Given'),
        firstPreferred: this.getNullable(values, headerMap, 'Name_First_Preferred'),
        maiden: this.getNullable(values, headerMap, 'Name_Maiden'),
        last: this.getNullable(values, headerMap, 'Name_Last'),
        suffix: this.getNullable(values, headerMap, 'Name_Suffix')
      },
      familyId: this.resolveFamilyId(values, headerMap, colorHex),
      birthday: birthdayResult.date || { year: 0, month: 1, day: 1 },
      spouseId: null,
      anniversaryDate: anniversaryResult.date,
      deathDate: deathResult.date,
      emails: this.parseEmails(values, headerMap),
      phones: this.parsePhones(values, headerMap),
      addresses: this.parseAddresses(values, headerMap),
      directDescendent: this.getValue(values, headerMap, 'Direct_Descendent?') === 'TRUE',
      generationNumber: generationNumResult.value,
      parentIds: [],
      lineage: this.getNullable(values, headerMap, 'Lineage_Full'),
      isLiving: isLiving,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return { person, errors, warnings };
  }

  private getValue(values: string[], headerMap: Record<string, number>, key: string): string {
    const idx = headerMap[key];
    return idx !== undefined ? values[idx] || '' : '';
  }

  private getNullable(values: string[], headerMap: Record<string, number>, key: string): string | null {
    const val = this.getValue(values, headerMap, key);
    return val || null;
  }

  private resolveFamilyId(values: string[], headerMap: Record<string, number>, colorHex: string | null): string | null {
    const familyName = this.getValue(values, headerMap, 'Family').trim();
    const familyIdFromCsv = this.getNullable(values, headerMap, 'ID');
    if (!familyName) return null;

    const key = familyName.toLowerCase();
    // Subsequent rows with the same family name share this draft.
    const pending = this.pendingFamilies.get(key);
    if (pending) return pending.id;

    const existingId = this.familyService.resolveFamilyIdByName(familyName);
    if (existingId) return existingId;

    // Preview is read-only: draft the family here and create it on Confirm.
    const hexColor = (colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex)) ? colorHex : '#808080';
    const newFamily: Family = {
      id: familyIdFromCsv || this.familyService.createPushId(),
      name: familyName,
      hexColor: hexColor,
      sortOrder: familyIdFromCsv || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.pendingFamilies.set(key, newFamily);

    return newFamily.id;
  }

  private parseDate(value: string, rowNum: number, label: string = 'Birthday'): { date: PersonDate | null; warning: string | null } {
    if (!value) {
      return { date: null, warning: null };
    }
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return {
        date: {
          year: parseInt(match[1], 10),
          month: parseInt(match[2], 10),
          day: parseInt(match[3], 10)
        },
        warning: null
      };
    }
    return { date: null, warning: `Invalid ${label} format '${value}', expected YYYY-MM-DD` };
  }

  private isBefore(a: PersonDate, b: PersonDate): boolean {
    if (a.year !== b.year) return a.year < b.year;
    if (a.month !== b.month) return a.month < b.month;
    return a.day < b.day;
  }

  private parseDateNullable(value: string, rowNum: number): { date: PersonDate | null; warning: string | null } {
    if (!value) return { date: null, warning: null };
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return {
        date: {
          year: parseInt(match[1], 10),
          month: parseInt(match[2], 10),
          day: parseInt(match[3], 10)
        },
        warning: null
      };
    }
    return { date: null, warning: `Invalid Anniversary format '${value}', expected YYYY-MM-DD` };
  }

  private parseGenerationNumber(value: string, rowNum: number): { value: number; error: string | null } {
    if (!value) return { value: 0, error: null };
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      return { value: 0, error: `Row ${rowNum}: Invalid Generation_Number '${value}'` };
    }
    return { value: parsed, error: null };
  }

  private parseEmails(values: string[], headerMap: Record<string, number>): Email[] {
    const emails: Email[] = [];
    const emailValue = this.getValue(values, headerMap, 'Email');
    if (emailValue) {
      emails.push({ address: emailValue, label: null });
    }
    return emails;
  }

  private parsePhones(values: string[], headerMap: Record<string, number>): Phone[] {
    const phones: Phone[] = [];
    const homePhone = this.getValue(values, headerMap, 'Phone_Home');
    const cellPhone = this.getValue(values, headerMap, 'Phone_Cell');

    if (homePhone) {
      phones.push({ label: 'Home', number: homePhone });
    }
    if (cellPhone) {
      phones.push({ label: 'Cell', number: cellPhone });
    }
    return phones;
  }

  private parseAddresses(values: string[], headerMap: Record<string, number>): Address[] {
    const addresses: Address[] = [];
    const street = this.getValue(values, headerMap, 'Address_Street');
    const city = this.getNullable(values, headerMap, 'Address_City');
    const state = this.getNullable(values, headerMap, 'Address_State');
    const zip = this.getNullable(values, headerMap, 'Address_Zip');
    const full = this.getNullable(values, headerMap, 'Address_Full');

    if (street || full) {
      addresses.push({
        street: street || null,
        city: city,
        state: state,
        zip: zip,
        full: full,
        label: 'Home'
      });
    }
    return addresses;
  }

  private resolveSpouses(): void {
    for (const parsed of this.parsedPeople) {
      const id = parsed.person.id;

      // Determine spouse ID using standard pattern: add or remove '-S' suffix
      // Exception: generation 0 IDs like '0-0' use '0-S' (not '0-0-S') as spouse
      let spouseId: string;
      if (id.endsWith('-S')) {
        spouseId = id.slice(0, -2);
      } else {
        spouseId = id + '-S';
      }

      // Check if spouse exists using standard pattern
      let spouse = this.parsedPeople.find(p =>
        p.person.id === spouseId && p.person.id !== id
      );

      // Special case: if no match and this is gen 0 (id like '0-0'), try alternate spouse ID '0-S'
      if (!spouse && id.startsWith('0-') && !id.endsWith('-S')) {
        spouse = this.parsedPeople.find(p => p.person.id === '0-S' && p.person.id !== id);
      }

      if (spouse) {
        parsed.person.spouseId = spouse.person.id;
        if (!spouse.person.spouseId) {
          spouse.person.spouseId = id;
        }
        // Share anniversaryDate between spouses
        if (parsed.person.anniversaryDate && !spouse.person.anniversaryDate) {
          spouse.person.anniversaryDate = parsed.person.anniversaryDate;
        } else if (spouse.person.anniversaryDate && !parsed.person.anniversaryDate) {
          parsed.person.anniversaryDate = spouse.person.anniversaryDate;
        }
      }
    }
  }

  private computeParentIds(): void {
    for (const parsed of this.parsedPeople) {
      const id = parsed.person.id;
      const generationNumber = parsed.person.generationNumber;

      // Special case 1: Generation 0 roots (0-0, 0-1, etc.) have no parents
      if (generationNumber === 0) {
        parsed.person.parentIds = [];
        // Always establish the spouse link for gen 0 (works for both regular and -S)
        const spouseId = id.endsWith('-S') ? id.slice(0, -2) : id + '-S';
        const spouseExists = this.parsedPeople.some(p => p.person.id === spouseId);
        if (spouseExists && !parsed.person.spouseId) {
          parsed.person.spouseId = spouseId;
        }
        continue;
      }

      // Special case 2: Spouses (-S suffix) have no parentIds
      if (id.endsWith('-S')) {
        // For generation 0 spouses, link back to the regular person
        if (generationNumber === 0) {
          const regularId = id.slice(0, -2);
          const regularExists = this.parsedPeople.some(p => p.person.id === regularId);
          if (regularExists && !parsed.person.spouseId) {
            parsed.person.spouseId = regularId;
          }
        }
        parsed.person.parentIds = [];
        continue;
      }

      // Special case 3: Generation 1 direct members (single letter like A, B)
      // get 0-0 and 0-1 as parents
      if (generationNumber === 1 && /^[A-Z]$/.test(id)) {
        parsed.person.parentIds = ['0-0', '0-1'];
        continue;
      }

      // Standard case: immediate parent is ID without last segment
      // If spouse parent exists (base + '-S'), include both parents
      const lastDashIndex = id.lastIndexOf('-');
      const parentId = id.substring(0, lastDashIndex);
      const spouseParentId = parentId + '-S';

      const parentIds: string[] = [parentId];

      // Check if spouse parent exists in the parsed data
      const spouseExists = this.parsedPeople.some(p => p.person.id === spouseParentId);
      if (spouseExists) {
        parentIds.push(spouseParentId);
      }

      parsed.person.parentIds = parentIds;
    }
  }

  confirmImport(): void {
    if (this.parsedPeople.length === 0 || this.isImporting || this.validationErrors.length > 0 || !this.peopleReady) return;

    this.isImporting = true;
    this.importError = null;
    this.lastImportSkipped = this.skippedMissingId;
    this.lastImportErrors = this.validationErrors.length;
    const people = this.parsedPeople.map(p => p.person);
    const families = Array.from(this.pendingFamilies.values());

    if (families.length === 0) {
      this.runImport(people);
      return;
    }

    Promise.all(families.map(family => this.familyService.saveFamily(family)))
      .then(() => {
        this.runImport(people, families);
      })
      .catch(err => {
        this.isImporting = false;
        this.importError = 'Import failed: ' + (err?.message || 'Unknown error');
        this.rollbackFamilies(families);
      });
  }

  private runImport(people: Person[], families: Family[] = []): void {
    this.peopleService.importPeople(people).subscribe({
      next: result => {
        this.isImporting = false;
        this.importResult = result;
        this.lastImportTimestamp = new Date().toLocaleString();
        this.pendingFamilies.clear();
        this.parsedPeople = [];
        this.importPreview = null;
        this.hasParsedFile = false;
        this.skippedMissingId = 0;
        this.previewPage = 1;
      },
      error: err => {
        this.isImporting = false;
        this.importError = 'Import failed: ' + (err?.message || 'Unknown error');
        this.rollbackFamilies(families);
      },
    });
  }

  private rollbackFamilies(families: Family[]): void {
    // best-effort: a failed delete must not mask the import error the admin sees.
    families.forEach(family => {
      this.familyService.deleteFamily(family.id).catch(() => undefined);
    });
  }

  cancelImport(): void {
    this.parsedPeople = [];
    this.importPreview = null;
    this.importError = null;
    this.hasParsedFile = false;
    this.skippedMissingId = 0;
    this.pendingFamilies.clear();
    this.previewPage = 1;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    this.readFile(input.files[0]);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    // dragleave also fires entering child nodes; only clear on the zone itself.
    if (event.currentTarget === event.target) {
      this.isDragOver = false;
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.readFile(file);
    }
  }

  private readFile(file: File): void {
    this.selectedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      this.parseCSV(content);
    };
    reader.readAsText(file);
  }

  formatBirthday(birthday: PersonDate): string {
    if (!birthday || birthday.year === 0) return '-';
    return `${birthday.month}/${birthday.day}/${birthday.year}`;
  }

  formatAnniversary(anniversaryDate: PersonDate | null): string {
    if (!anniversaryDate) return '-';
    return `${anniversaryDate.month}/${anniversaryDate.day}/${anniversaryDate.year}`;
  }

  get previewPageData(): Page<ParsedPerson> {
    return paginate(this.parsedPeople, this.previewPage, this.previewPageSize);
  }

  get skippedSummary(): string {
    const rowLabel = this.skippedMissingId === 1 ? 'row' : 'rows';
    return `${this.skippedMissingId} ${rowLabel} skipped: missing ID`;
  }

  get importResultSummary(): string {
    if (!this.importResult) return '';
    const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
    const rows = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`;
    const errors = (n: number) => `${n} ${n === 1 ? 'error' : 'errors'}`;
    return `${people(this.importResult.created)} created, ${people(this.importResult.updated)} updated, `
      + `${rows(this.lastImportSkipped)} skipped, ${errors(this.lastImportErrors)}.`;
  }

  get previewShowingRange(): string {
    return pageRange(this.previewPageData);
  }

  previousPreviewPage(): void {
    this.previewPage = Math.max(1, this.previewPage - 1);
  }

  nextPreviewPage(): void {
    this.previewPage = Math.min(this.previewPageData.pageCount, this.previewPage + 1);
  }

  getAddressStreet(person: Person): string {
    const addr = (person.addresses || [])[0];
    return addr?.street || '-';
  }

  getAddressCity(person: Person): string {
    const addr = (person.addresses || [])[0];
    return addr?.city || '-';
  }

  getAddressState(person: Person): string {
    const addr = (person.addresses || [])[0];
    return addr?.state || '-';
  }

  getAddressZip(person: Person): string {
    const addr = (person.addresses || [])[0];
    return addr?.zip || '-';
  }
}