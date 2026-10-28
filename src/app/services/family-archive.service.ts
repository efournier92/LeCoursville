import { Injectable } from '@angular/core';
import { serverTimestamp } from 'firebase/database';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { RtdbService } from './rtdb.service';

export interface FamilyPerson {
  id: string;
  given?: string | null;
  surname?: string | null;
  name?: string | null;
  suffix?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  deathDate?: string | null;
  deathPlace?: string | null;
  burialDate?: string | null;
  burialPlace?: string | null;
  occupation?: string | null;
  fatherId?: string | null;
  motherId?: string | null;
  spouseIds?: string[];
  childIds?: string[];
  marriageYears?: Record<string, number>;
  note?: string | null;
}

export interface FamilyArchive {
  title: string;
  published: boolean;
  updatedAt?: number;
  updatedBy?: string;
  people: Record<string, FamilyPerson>;
}

export interface ArchiveListItem {
  title: string;
  published: boolean;
  updatedAt?: number;
}

// Whitelist per the ingest rule: poster fields minus photos; anything else is dropped.
const PERSON_FIELDS = [
  'id', 'given', 'surname', 'name', 'suffix', 'sex',
  'birthDate', 'birthPlace', 'deathDate', 'deathPlace',
  'burialDate', 'burialPlace', 'occupation', 'fatherId', 'motherId',
  'spouseIds', 'childIds', 'marriageYears', 'note',
] as const;

export interface ParsedPeople {
  people: Record<string, FamilyPerson>;
  count: number;
}

/** Parses and validates an uploaded poster blob; throws Error with a user-facing reason. */
export function parseFamilyPeople(rawJson: string): ParsedPeople {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Could not parse the JSON.');
  }
  // The blob is either a bare person array or an object holding one.
  const array = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { people?: unknown[] }).people))
      ? (parsed as { people: unknown[] }).people
      : null;
  if (!array) {
    throw new Error('JSON must be an object with a "people" array (or a bare person array).');
  }
  if (array.length < 2) {
    throw new Error('At least 2 person records are required.');
  }
  const people: Record<string, FamilyPerson> = {};
  for (const raw of array) {
    if (!raw || typeof raw !== 'object' || !(raw as { id?: unknown }).id) {
      throw new Error('Every person record needs an id.');
    }
    const source = raw as Record<string, unknown>;
    if (people[source.id as string]) {
      throw new Error(`Duplicate person id: ${source.id}.`);
    }
    const person: Record<string, unknown> = {};
    for (const field of PERSON_FIELDS) {
      if (source[field] !== undefined) {
        person[field] = source[field];
      }
    }
    people[source.id as string] = person as unknown as FamilyPerson;
  }
  return { people, count: array.length };
}

@Injectable({ providedIn: 'root' })
export class FamilyArchiveService {

  constructor(
    private rtdb: RtdbService,
    private auth: AuthService,
  ) {}

  getArchive(familyId: string): Observable<FamilyArchive | null> {
    return this.rtdb.object<FamilyArchive>('familyArchive/' + familyId).valueChanges();
  }

  listArchives(): Observable<Record<string, ArchiveListItem> | null> {
    return this.rtdb.object<Record<string, ArchiveListItem>>('familyArchive').valueChanges();
  }

  async ingest(familyId: string, title: string, published: boolean, rawJson: string): Promise<ParsedPeople> {
    if (!/^[a-z0-9-]+$/.test(familyId)) {
      throw new Error('Family id must be lowercase letters, numbers, and dashes.');
    }
    if (!title || !title.trim()) {
      throw new Error('Title is required.');
    }
    const { people, count } = parseFamilyPeople(rawJson);
    const uid = this.auth.user?.id;
    if (!uid) {
      throw new Error('You must be signed in.');
    }
    await this.rtdb.object(`familyArchive/${familyId}`).set({
      title: title.trim(),
      published,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      people,
    });
    return { people, count };
  }
}
