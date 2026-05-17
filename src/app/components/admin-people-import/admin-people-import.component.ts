import { Component, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { PeopleService, ImportResult } from 'src/app/services/people.service';
import { ClanService } from 'src/app/services/clan.service';
import { Clan } from 'src/app/models/clan';
import { Person, PersonDate, Email, Phone } from 'src/app/models/person';
import { Address } from 'src/app/models/address';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface ParsedPerson {
  person: Person;
  errors: string[];
  warnings: string[];
}

@Component({
  selector: 'app-admin-people-import',
  templateUrl: './admin-people-import.component.html',
  styleUrls: ['./admin-people-import.component.scss']
})
export class AdminPeopleImportComponent implements OnInit {
  parsedPeople: ParsedPerson[] = [];
  validationErrors: string[] = [];
  validationWarnings: string[] = [];
  importPreview: { total: number; created: number; updated: number; inactive: number } | null = null;
  lastImportTimestamp: string | null = null;
  isImporting = false;
  importResult: ImportResult | null = null;
  selectedFileName: string | null = null;
  private clansByNameMap: Map<string, Clan> = new Map();

  // Pagination
  previewPageSize = 20;
  previewPageIndex = 0;
  previewPageSizeOptions = [20, 50, 100];

  constructor(
    private peopleService: PeopleService,
    private clanService: ClanService
  ) {}

  ngOnInit(): void {
    this.clanService.clans$.subscribe(clans => {
      this.clansByNameMap = new Map(clans.map(c => [c.name.toLowerCase(), c]));
    });
  }

  parseCSV(rawCsv: string): void {
    this.validationErrors = [];
    this.validationWarnings = [];
    this.parsedPeople = [];

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
      this.importPreview = {
        total: this.parsedPeople.length,
        created: this.parsedPeople.length,
        updated: 0,
        inactive: 0
      };
    }
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

    const birthdayResult = this.parseDate(this.getValue(values, headerMap, 'Birthday'), rowNum, true);
    if (birthdayResult.warning) {
      warnings.push(`Row ${rowNum}: ${birthdayResult.warning}`);
    }

    const anniversaryResult = this.parseDateNullable(this.getValue(values, headerMap, 'Anniversary'), rowNum);
    if (anniversaryResult.warning) {
      warnings.push(`Row ${rowNum}: ${anniversaryResult.warning}`);
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
      clanId: this.resolveClanId(values, headerMap, colorHex),
      birthday: birthdayResult.date || { year: 0, month: 1, day: 1 },
      spouseId: null,
      anniversaryDate: anniversaryResult.date,
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

  private resolveClanId(values: string[], headerMap: Record<string, number>, colorHex: string | null): string | null {
    const clanName = this.getValue(values, headerMap, 'Clan').trim();
    const clanIdFromCsv = this.getNullable(values, headerMap, 'ID');
    if (!clanName) return null;

    // Case-insensitive lookup in clansByNameMap
    const clan = this.clansByNameMap.get(clanName.toLowerCase());
    if (clan) return clan.id;

    // Auto-create clan with ID from CSV if provided, otherwise use generated push ID
    const hexColor = (colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex)) ? colorHex : '#808080';
    const newClan: Clan = {
      id: clanIdFromCsv || this.clanService.createPushId(),
      name: clanName,
      hexColor: hexColor,
      sortOrder: clanIdFromCsv || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.clanService.saveClan(newClan);

    // Update the map with the new clan so subsequent rows with same name use the same clan
    this.clansByNameMap.set(clanName.toLowerCase(), newClan);

    return newClan.id;
  }

  private parseDate(value: string, rowNum: number, isBirthday: boolean = false): { date: PersonDate | null; warning: string | null } {
    if (!value) {
      if (isBirthday) {
        return { date: { year: 0, month: 1, day: 1 }, warning: null };
      }
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
    if (isBirthday) {
      return { date: { year: 0, month: 1, day: 1 }, warning: `Invalid Birthday format '${value}', expected YYYY-MM-DD` };
    }
    return { date: null, warning: `Invalid Anniversary format '${value}', expected YYYY-MM-DD` };
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
    if (this.parsedPeople.length === 0) return;

    this.isImporting = true;
    const people = this.parsedPeople.map(p => p.person);

    this.peopleService.importPeople(people).pipe(
      catchError(err => {
        this.isImporting = false;
        this.validationErrors.push('Import failed: ' + err.message);
        return of({ created: 0, updated: 0, inactive: 0, conflicts: [] });
      })
    ).subscribe(result => {
      this.isImporting = false;
      this.importResult = result;
      this.lastImportTimestamp = new Date().toLocaleString();
      this.parsedPeople = [];
      this.importPreview = null;
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
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

  onPreviewPage(event: PageEvent): void {
    this.previewPageIndex = event.pageIndex;
    this.previewPageSize = event.pageSize;
  }

  getPagedParsedPeople(): ParsedPerson[] {
    const start = this.previewPageIndex * this.previewPageSize;
    return this.parsedPeople.slice(start, start + this.previewPageSize);
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