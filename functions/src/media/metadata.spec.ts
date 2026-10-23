import { describe, expect, it } from "vitest";
import { normalizeMetadata, normalizeTrackTitles } from "./metadata";

const base = { title: "Recital", date: "2026-10-23" };

function normalize(overrides: Record<string, unknown> = {}) {
  return normalizeMetadata({ ...base, ...overrides });
}

function capture(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

const invalid = { code: "invalid-argument" };

describe("normalizeMetadata", () => {
  it("trims the title", () => {
    expect(normalize({ title: "  Spring Recital  " }).title).toBe(
      "Spring Recital"
    );
  });

  it("accepts titles at the 1 and 200 character bounds", () => {
    expect(normalize({ title: "A" }).title).toBe("A");
    expect(normalize({ title: "a".repeat(200) }).title).toHaveLength(200);
  });

  it("rejects an empty or 201 character title", () => {
    expect(capture(() => normalize({ title: "   " }))).toMatchObject(invalid);
    expect(capture(() => normalize({ title: "a".repeat(201) }))).toMatchObject(
      invalid
    );
  });

  it("trims the date", () => {
    expect(normalize({ date: "  2026-10-23  " }).date).toBe("2026-10-23");
  });

  it("accepts dates at the 4 and 40 character bounds", () => {
    expect(normalize({ date: " 2026 " }).date).toBe("2026");
    expect(normalize({ date: "d".repeat(40) }).date).toHaveLength(40);
  });

  it("accepts a minute and an hour duration", () => {
    expect(normalize({ duration: "3:45" }).duration).toBe("3:45");
    expect(normalize({ duration: "1:02:03" }).duration).toBe("1:02:03");
  });

  it.each(["3:4", "abc", "3:45:6"])("rejects the duration %s", (duration) => {
    expect(capture(() => normalize({ duration }))).toMatchObject(invalid);
  });

  it("accepts booleans only when they are literal true", () => {
    const accepted = normalize({ isSticky: true, isHidden: true });
    expect(accepted.isSticky).toBe(true);
    expect(accepted.isHidden).toBe(true);

    const rejected = normalize({ isSticky: "true", isHidden: 1 });
    expect(rejected.isSticky).toBe(false);
    expect(rejected.isHidden).toBe(false);
  });
});

describe("normalizeTrackTitles", () => {
  it("trims accepted titles", () => {
    expect(normalizeTrackTitles(["  First  ", "Second"], 2)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("rejects a non-array", () => {
    expect(capture(() => normalizeTrackTitles("First", 1))).toMatchObject(
      invalid
    );
  });

  it("rejects a title count that does not match the tracks", () => {
    expect(capture(() => normalizeTrackTitles(["First"], 2))).toMatchObject(
      invalid
    );
  });

  it("rejects an empty title", () => {
    expect(capture(() => normalizeTrackTitles(["First", "   "], 2))).toMatchObject(
      invalid
    );
  });

  it("rejects a title over 200 characters", () => {
    expect(
      capture(() => normalizeTrackTitles(["a".repeat(201)], 1))
    ).toMatchObject(invalid);
  });
});
