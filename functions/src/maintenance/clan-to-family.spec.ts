import { describe, expect, it } from "vitest";

import { mergeFamilyNodes } from "./clan-to-family";

function clan(id: string, name: string, hexColor: string, sortOrder: string) {
  return { id, name, hexColor, sortOrder, createdAt: 1, updatedAt: 1 };
}

describe("mergeFamilyNodes", () => {
  it("copies every clan, preserving ids, when the families node is empty", () => {
    const clans = {
      "clan-1": clan("clan-1", "Mignonne", "#F44336", "A"),
      "clan-2": clan("clan-2", "Denis", "#2196F3", "B"),
    };

    const result = mergeFamilyNodes(clans, {}, {});

    expect(result.families).toEqual(clans);
    expect(Object.keys(result.families)).toEqual(["clan-1", "clan-2"]);
    expect(result.stats).toMatchObject({ mergedByName: 0, familiesOnly: 0, familiesOut: 2 });

    const empty = mergeFamilyNodes(null, null, null);
    expect(empty.families).toEqual({});
    expect(empty.people).toEqual({});
    expect(empty.conflicts).toEqual([]);
  });

  it("keeps the clan record and reports a colour conflict when names overlap", () => {
    const clans = { "clan-1": clan("clan-1", "Mignonne", "#F44336", "A") };
    const families = { "family-1": clan("family-1", "Mignonne", "#2196F3", "M") };

    const result = mergeFamilyNodes(clans, families, {});

    expect(result.families).toEqual({ "clan-1": clans["clan-1"] });
    expect(result.families["family-1"]).toBeUndefined();
    expect(result.stats.mergedByName).toBe(1);
    expect(result.conflicts).toEqual([
      {
        kind: "color",
        name: "Mignonne",
        clanId: "clan-1",
        familyId: "family-1",
        clanHexColor: "#F44336",
        familyHexColor: "#2196F3",
      },
    ]);
  });

  it("reports a duplicate-name family that the merge does not keep", () => {
    const clans = { xyz: clan("xyz", "Smith", "#111111", "0") };
    const families = {
      abc: clan("abc", "Smith", "#222222", "9"),
      def: clan("def", "Smith", "#333333", "10"),
    };

    const result = mergeFamilyNodes(clans, families, {});

    expect(Object.keys(result.families)).toEqual(["xyz"]);
    expect(result.stats.familiesOut).toBe(1);
    expect(result.conflicts).toEqual([
      {
        kind: "color",
        name: "Smith",
        clanId: "xyz",
        familyId: "abc",
        clanHexColor: "#111111",
        familyHexColor: "#222222",
      },
      {
        kind: "duplicate-name",
        name: "Smith",
        familyId: "def",
        keptFamilyId: "abc",
      },
    ]);
  });

  it("keeps a family edited under a clan id and reports the key collision", () => {
    const clans = { xyz: clan("xyz", "Smith", "#111111", "0") };
    const families = { xyz: clan("xyz", "Renamed", "#999999", "0") };

    const result = mergeFamilyNodes(clans, families, {});

    expect(result.families).toEqual({ xyz: families.xyz });
    expect(result.stats.familiesOut).toBe(1);
    expect(result.stats.mergeTable).toEqual([
      {
        clanId: "xyz",
        familyId: "xyz",
        name: "Smith",
        sortOrder: "0",
        action: "skipped",
        replacedFamilyId: null,
      },
    ]);
    expect(result.conflicts).toEqual([
      {
        kind: "key-collision",
        clanId: "xyz",
        familyId: "xyz",
        clanName: "Smith",
        familyName: "Renamed",
      },
    ]);
  });

  it("keeps a same-name family when its clan is skipped by a key collision", () => {
    const clans = { xyz: clan("xyz", "Smith", "#111111", "0") };
    const families = {
      xyz: clan("xyz", "Renamed", "#999999", "0"),
      abc: clan("abc", "Smith", "#123123", "1"),
    };

    const result = mergeFamilyNodes(clans, families, {});

    expect(Object.keys(result.families).sort()).toEqual(["abc", "xyz"]);
    expect(result.families.abc).toEqual(families.abc);
    expect(result.families.xyz).toEqual(families.xyz);
    expect(result.stats.familiesOut).toBe(2);
    expect(result.stats.familiesOnly).toBe(2);
  });

  it("reports a colour conflict for a same-key family that keeps the clan name", () => {
    const clans = { xyz: clan("xyz", "Smith", "#111111", "0") };
    const families = { xyz: clan("xyz", "Smith", "#222222", "0") };

    const result = mergeFamilyNodes(clans, families, {});

    expect(result.families).toEqual({ xyz: clans.xyz });
    expect(result.conflicts).toEqual([
      {
        kind: "color",
        name: "Smith",
        clanId: "xyz",
        familyId: "xyz",
        clanHexColor: "#111111",
        familyHexColor: "#222222",
      },
    ]);
  });

  it("remaps an existing familyId when its family is replaced by a clan", () => {
    const clans = { zzz: clan("zzz", "Wick", "#000000", "0") };
    const families = { abc: clan("abc", "Wick", "#000000", "0") };
    const people = { p1: { id: "p1", familyId: "abc" } };

    const result = mergeFamilyNodes(clans, families, people);

    expect(result.people.p1.familyId).toBe("zzz");
    expect(result.stats.familyIdsRemapped).toBe(1);
  });

  it("remaps a familyId that points at an ignored duplicate-name family", () => {
    const clans = { xyz: clan("xyz", "Smith", "#111111", "0") };
    const families = {
      abc: clan("abc", "Smith", "#222222", "1"),
      def: clan("def", "Smith", "#333333", "2"),
    };
    const people = { p3: { id: "p3", familyId: "def" } };

    const result = mergeFamilyNodes(clans, families, people);

    expect(result.people.p3.familyId).toBe("xyz");
    expect(result.stats.familyIdsRemapped).toBe(1);
  });

  it("reports a sortOrder conflict for a same-key family", () => {
    const clans = { xyz: clan("xyz", "Smith", "#111111", "0") };
    const families = { xyz: clan("xyz", "Smith", "#111111", "7") };

    const result = mergeFamilyNodes(clans, families, {});

    expect(result.families).toEqual({ xyz: clans.xyz });
    expect(result.conflicts).toEqual([
      {
        kind: "field-conflict",
        name: "Smith",
        clanId: "xyz",
        familyId: "xyz",
        field: "sortOrder",
        clanValue: "0",
        familyValue: "7",
      },
    ]);
  });

  it("survives families-only records untouched", () => {
    const clans = { "clan-1": clan("clan-1", "Mignonne", "#F44336", "A") };
    const families = {
      "family-1": clan("family-1", "Mignonne", "#F44336", "A"),
      "family-2": clan("family-2", "Nouveau", "#4CAF50", "C"),
    };

    const result = mergeFamilyNodes(clans, families, {});

    expect(result.families["family-2"]).toEqual(families["family-2"]);
    expect(result.stats.familiesOnly).toBe(1);
    expect(result.conflicts).toEqual([]);
  });

  it("gives every person a familyId mapped from their clanId", () => {
    const clans = {
      "clan-1": clan("clan-1", "Mignonne", "#F44336", "A"),
      "clan-2": clan("clan-2", "Denis", "#2196F3", "B"),
    };
    const people = {
      p1: { id: "p1", clanId: "clan-1" },
      p2: { id: "p2", clanId: "clan-2" },
      p3: { id: "p3", clanId: null },
    };

    const result = mergeFamilyNodes(clans, {}, people);

    expect(result.people.p1).toEqual({ id: "p1", clanId: "clan-1", familyId: "clan-1" });
    expect(result.people.p2).toEqual({ id: "p2", clanId: "clan-2", familyId: "clan-2" });
    expect(result.people.p3).toEqual({ id: "p3", clanId: null });
    expect(result.stats.peopleGainingFamilyId).toBe(2);
  });

  it("is idempotent on its own output", () => {
    const clans = { "clan-1": clan("clan-1", "Mignonne", "#F44336", "A") };
    const families = { "family-1": clan("family-1", "Mignonne", "#F44336", "A") };
    const people = { p1: { id: "p1", clanId: "clan-1" } };

    const first = mergeFamilyNodes(clans, families, people);
    const second = mergeFamilyNodes(clans, first.families, first.people);

    expect(second.families).toEqual(first.families);
    expect(second.people).toEqual(first.people);
    expect(second.conflicts).toEqual([]);
    expect(second.stats.peopleGainingFamilyId).toBe(0);
  });

  it("orders output by sortOrder then name", () => {
    const clans = {
      "clan-3": clan("clan-3", "Zulu", "#000003", "B"),
      "clan-1": clan("clan-1", "Beta", "#000001", "A"),
      "clan-2": clan("clan-2", "Alpha", "#000002", "A"),
    };

    const result = mergeFamilyNodes(clans, {}, {});

    expect(Object.keys(result.families)).toEqual(["clan-2", "clan-1", "clan-3"]);
  });

  it("reports orphan clanId values instead of dropping them", () => {
    const people = {
      p1: { id: "p1", clanId: "ghost" },
      p2: { id: "p2", clanId: "ghost" },
    };

    const result = mergeFamilyNodes({}, {}, people);

    expect(result.people.p1).toEqual({ id: "p1", clanId: "ghost" });
    expect(result.people.p2).toEqual({ id: "p2", clanId: "ghost" });
    expect(result.stats.orphanClanIds).toEqual(["ghost"]);
    expect(result.conflicts).toEqual([
      { kind: "orphan-clan-id", personId: "p1", clanId: "ghost" },
      { kind: "orphan-clan-id", personId: "p2", clanId: "ghost" },
    ]);
  });
});
