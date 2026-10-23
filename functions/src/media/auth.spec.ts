import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("../test-support");
  return { getDatabase: () => fakeDb };
});

import { requireMediaAdmin } from "./auth";
import { fakeDb, resetFakeState } from "../test-support";

function invoke(uid: string | null) {
  return requireMediaAdmin({
    auth: uid ? { uid, token: {} } : null,
  } as never);
}

describe("requireMediaAdmin", () => {
  beforeEach(() => resetFakeState());
  afterEach(() => vi.restoreAllMocks());

  it("rejects a caller with no auth", async () => {
    await expect(invoke(null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("denies a signed-in user with no roles", async () => {
    await fakeDb.ref("users/user-1/roles").set({ user: true });

    await expect(invoke("user-1")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("returns the uid for an admin", async () => {
    await fakeDb
      .ref("users/admin-1/roles")
      .set({ user: true, admin: true, super: false });

    await expect(invoke("admin-1")).resolves.toBe("admin-1");
  });

  it("returns the uid for a super", async () => {
    await fakeDb
      .ref("users/super-1/roles")
      .set({ user: true, admin: false, super: true });

    await expect(invoke("super-1")).resolves.toBe("super-1");
  });

  it("reads the caller's roles once per call", async () => {
    await fakeDb.ref("users/admin-1/roles").set({ user: true, admin: true });
    const refSpy = vi.spyOn(fakeDb, "ref");

    await invoke("admin-1");
    expect(refSpy.mock.calls.map(([path]) => path)).toEqual([
      "users/admin-1/roles",
    ]);

    await invoke("admin-1");
    expect(refSpy).toHaveBeenCalledTimes(2);
  });
});
