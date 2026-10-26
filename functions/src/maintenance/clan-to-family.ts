/**
 * Pure transform behind scripts/migrations/clan-to-family.mjs.
 *
 * The legacy `clans` node and `Person.clanId` are migrated to `families` and
 * `Person.familyId` by name. Nothing here deletes legacy data; the runner owns
 * the destructive cleanup after its post-checks pass.
 */

export interface FamilyRecord {
  id?: string;
  name: string;
  hexColor?: string;
  sortOrder?: string;
  [key: string]: unknown;
}

export interface PersonRecord {
  id?: string;
  clanId?: string | null;
  familyId?: string | null;
  [key: string]: unknown;
}

export type NodeMap<T> = Record<string, T>;

export interface MergeTableRow {
  clanId: string;
  familyId: string;
  name: string;
  sortOrder: string;
  action: "copied" | "merged" | "skipped";
  /** Id of the `families` record replaced by this clan, when merged by name. */
  replacedFamilyId: string | null;
}

export interface ColorConflict {
  kind: "color";
  name: string;
  clanId: string;
  familyId: string;
  clanHexColor: string | null;
  familyHexColor: string | null;
}

export interface OrphanConflict {
  kind: "orphan-clan-id";
  personId: string;
  clanId: string;
}

export interface DuplicateNameConflict {
  kind: "duplicate-name";
  name: string;
  familyId: string;
  keptFamilyId: string;
}

export interface KeyCollisionConflict {
  kind: "key-collision";
  clanId: string;
  familyId: string;
  clanName: string;
  familyName: string;
}

export interface FieldConflict {
  kind: "field-conflict";
  name: string;
  clanId: string;
  familyId: string;
  field: "sortOrder";
  clanValue: string | null;
  familyValue: string | null;
}

export type MergeConflict =
  | ColorConflict
  | OrphanConflict
  | DuplicateNameConflict
  | KeyCollisionConflict
  | FieldConflict;

export interface MergeStats {
  /** Input record counts. */
  clans: number;
  families: number;
  people: number;
  /** Output record count. */
  familiesOut: number;
  mergedByName: number;
  familiesOnly: number;
  /** People whose `familyId` changes in this run (0 on a repeat run). */
  peopleGainingFamilyId: number;
  /** People whose existing `familyId` followed a replaced family id. */
  familyIdsRemapped: number;
  /** Distinct `clanId` values with no matching clan record. */
  orphanClanIds: string[];
  /** Legacy clan id -> output family id. */
  idMap: Record<string, string>;
  mergeTable: MergeTableRow[];
}

export interface MergeResult {
  families: NodeMap<FamilyRecord>;
  people: NodeMap<PersonRecord>;
  conflicts: MergeConflict[];
  stats: MergeStats;
}

function asMap<T>(value: unknown): NodeMap<T> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as NodeMap<T>)
    : {};
}

function recordOf<T>(value: unknown): T | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : null;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortOrderOf(record: FamilyRecord): string {
  return typeof record.sortOrder === "string" ? record.sortOrder : "";
}

function nameOf(record: FamilyRecord): string {
  return typeof record.name === "string" ? record.name : "";
}

function compareFamilyEntries(
  [aKey, a]: [string, FamilyRecord],
  [bKey, b]: [string, FamilyRecord]
): number {
  return (
    compareText(sortOrderOf(a), sortOrderOf(b)) ||
    compareText(nameOf(a), nameOf(b)) ||
    compareText(aKey, bKey)
  );
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Merge `clans` into `families` by exact name and stamp `familyId` on people.
 * Inputs may be null or missing, matching an empty RTDB node.
 */
export function mergeFamilyNodes(
  clansInput: unknown,
  familiesInput: unknown,
  peopleInput: unknown
): MergeResult {
  const clans = asMap<FamilyRecord>(clansInput);
  const families = asMap<FamilyRecord>(familiesInput);
  const people = asMap<PersonRecord>(peopleInput);

  const clanNames = new Set<string>();
  const clanEntries: Array<[string, FamilyRecord]> = [];
  for (const key of Object.keys(clans)) {
    const record = recordOf<FamilyRecord>(clans[key]);
    if (!record) continue;
    clanEntries.push([key, record]);
    const name = textOrNull(record.name);
    if (name) clanNames.add(name);
  }
  clanEntries.sort(compareFamilyEntries);

  const clanIds = new Set(clanEntries.map(([key]) => key));
  const familyIdMap: Record<string, string> = {};
  const familyByName = new Map<string, { key: string; record: FamilyRecord }>();
  const familyOnlyEntries: Array<[string, FamilyRecord]> = [];
  const duplicateNameConflicts: MergeConflict[] = [];
  for (const key of Object.keys(families).sort(compareText)) {
    const record = recordOf<FamilyRecord>(families[key]);
    if (!record) continue;
    const name = textOrNull(record.name);
    if (name && clanNames.has(name)) {
      // A family under a clan id is the same record; the clan copy owns it.
      if (clanIds.has(key)) continue;
      // Deterministic: the first family id in key order wins the merge.
      const kept = familyByName.get(name);
      if (!kept) {
        familyByName.set(name, { key, record });
      } else {
        // One name survives by design; surface the ignored duplicate and
        // follow its reference through to whatever replaces the kept record.
        duplicateNameConflicts.push({
          kind: "duplicate-name",
          name,
          familyId: key,
          keptFamilyId: kept.key,
        });
        familyIdMap[key] = kept.key;
      }
    } else {
      familyOnlyEntries.push([key, record]);
    }
  }

  const outputEntries: Array<[string, FamilyRecord]> = [];
  const idMap: Record<string, string> = {};
  const mergeTable: MergeTableRow[] = [];
  const conflicts: MergeConflict[] = [...duplicateNameConflicts];
  const familyOnlyKeys = new Set(familyOnlyEntries.map(([key]) => key));
  const consumedNames = new Set<string>();
  let mergedByName = 0;

  for (const [clanId, clan] of clanEntries) {
    const name = textOrNull(clan.name);
    const match = name ? familyByName.get(name) : undefined;
    idMap[clanId] = clanId;
    const sameKeyFamily = recordOf<FamilyRecord>(families[clanId]);
    if (sameKeyFamily && !familyOnlyKeys.has(clanId) && textOrNull(sameKeyFamily.name) === (name ?? "")) {
      // Same id and name: the clan hex wins by spec, but never silently.
      const clanHex = textOrNull(clan.hexColor);
      const familyHex = textOrNull(sameKeyFamily.hexColor);
      if (clanHex !== familyHex) {
        conflicts.push({
          kind: "color",
          name: name ?? "",
          clanId,
          familyId: clanId,
          clanHexColor: clanHex,
          familyHexColor: familyHex,
        });
      }
      const clanSort = sortOrderOf(clan);
      const familySort = sortOrderOf(sameKeyFamily);
      if (clanSort !== familySort) {
        conflicts.push({
          kind: "field-conflict",
          name: name ?? "",
          clanId,
          familyId: clanId,
          field: "sortOrder",
          clanValue: clanSort || null,
          familyValue: familySort || null,
        });
      }
    }
    if (familyOnlyKeys.has(clanId)) {
      // The admin renamed this record after a previous apply. Keep the edit.
      const renamed = recordOf<FamilyRecord>(families[clanId]);
      conflicts.push({
        kind: "key-collision",
        clanId,
        familyId: clanId,
        clanName: name ?? "",
        familyName: textOrNull(renamed?.name) ?? "",
      });
      mergeTable.push({
        clanId,
        familyId: clanId,
        name: name ?? "",
        sortOrder: sortOrderOf(clan),
        action: "skipped",
        replacedFamilyId: null,
      });
      continue;
    }
    outputEntries.push([clanId, { ...clan }]);
    if (match) {
      mergedByName += 1;
      consumedNames.add(name ?? "");
      familyIdMap[match.key] = clanId;
      mergeTable.push({
        clanId,
        familyId: clanId,
        name: name ?? "",
        sortOrder: sortOrderOf(clan),
        action: "merged",
        replacedFamilyId: match.key,
      });
      const clanHex = textOrNull(clan.hexColor);
      const familyHex = textOrNull(match.record.hexColor);
      if (clanHex !== familyHex) {
        conflicts.push({
          kind: "color",
          name: name ?? "",
          clanId,
          familyId: match.key,
          clanHexColor: clanHex,
          familyHexColor: familyHex,
        });
      }
    } else {
      mergeTable.push({
        clanId,
        familyId: clanId,
        name: name ?? "",
        sortOrder: sortOrderOf(clan),
        action: "copied",
        replacedFamilyId: null,
      });
    }
  }

  let keptAfterSkip = 0;
  for (const [name, entry] of familyByName) {
    if (!consumedNames.has(name)) {
      outputEntries.push([entry.key, { ...entry.record }]);
      keptAfterSkip += 1;
    }
  }
  for (const [familyId, family] of familyOnlyEntries) {
    outputEntries.push([familyId, { ...family }]);
  }
  outputEntries.sort(compareFamilyEntries);

  const outFamilies: NodeMap<FamilyRecord> = {};
  for (const [key, record] of outputEntries) outFamilies[key] = record;

  mergeTable.sort(
    (a, b) =>
      compareText(a.sortOrder, b.sortOrder) ||
      compareText(a.name, b.name) ||
      compareText(a.familyId, b.familyId)
  );

  const familyIds = new Set(Object.keys(outFamilies));
  const orphanIds = new Set<string>();
  const outPeople: NodeMap<PersonRecord> = {};
  let peopleGainingFamilyId = 0;
  let familyIdsRemapped = 0;

  for (const personKey of Object.keys(people).sort(compareText)) {
    const person = recordOf<PersonRecord>(people[personKey]);
    if (!person) {
      outPeople[personKey] = { id: personKey } as PersonRecord;
      continue;
    }
    const next: PersonRecord = { ...person };
    const clanId = textOrNull(person.clanId);
    if (clanId) {
      const target = idMap[clanId] ?? (familyIds.has(clanId) ? clanId : null);
      if (target) {
        if (next.familyId !== target) {
          next.familyId = target;
          peopleGainingFamilyId += 1;
        }
      } else {
        orphanIds.add(clanId);
        conflicts.push({ kind: "orphan-clan-id", personId: personKey, clanId });
      }
    } else {
      const existingFamilyId = textOrNull(person.familyId);
      let mapped = existingFamilyId ? familyIdMap[existingFamilyId] : null;
      for (let hop = 0; mapped && familyIdMap[mapped] && familyIdMap[mapped] !== mapped && hop < 5; hop += 1) {
        mapped = familyIdMap[mapped];
      }
      if (mapped && mapped !== next.familyId) {
        next.familyId = mapped;
        familyIdsRemapped += 1;
      }
    }
    outPeople[personKey] = next;
  }

  conflicts.sort((a, b) => {
    if (a.kind !== b.kind) return compareText(a.kind, b.kind);
    if (a.kind === "color" && b.kind === "color") {
      return compareText(a.name, b.name) || compareText(a.clanId, b.clanId);
    }
    if (a.kind === "orphan-clan-id" && b.kind === "orphan-clan-id") {
      return compareText(a.personId, b.personId) || compareText(a.clanId, b.clanId);
    }
    if (a.kind === "duplicate-name" && b.kind === "duplicate-name") {
      return compareText(a.name, b.name) || compareText(a.familyId, b.familyId);
    }
    if (a.kind === "key-collision" && b.kind === "key-collision") {
      return compareText(a.clanId, b.clanId) || compareText(a.familyName, b.familyName);
    }
    if (a.kind === "field-conflict" && b.kind === "field-conflict") {
      return compareText(a.clanId, b.clanId) || compareText(a.field, b.field);
    }
    return 0;
  });

  const stats: MergeStats = {
    clans: Object.keys(clans).length,
    families: Object.keys(families).length,
    people: Object.keys(people).length,
    familiesOut: Object.keys(outFamilies).length,
    mergedByName,
    familiesOnly: familyOnlyEntries.length + keptAfterSkip,
    peopleGainingFamilyId,
    familyIdsRemapped,
    orphanClanIds: Array.from(orphanIds).sort(compareText),
    idMap,
    mergeTable,
  };

  return { families: outFamilies, people: outPeople, conflicts, stats };
}
