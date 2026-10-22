import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import { changeUserRole } from "./change-user-role";
import { fakeDb, resetFakeState } from "./test-support";

const superAuth = {
  uid: "super-1",
  token: { email: "super@example.com" },
  rawToken: "token",
};

function invoke(data: Record<string, unknown>, auth: unknown = superAuth) {
  return changeUserRole.run({ data, auth, rawRequest: {} } as never);
}

async function seedUser(
  uid: string,
  roles: Record<string, boolean>,
  email?: string
): Promise<void> {
  await fakeDb.ref(`users/${uid}`).set({
    id: uid,
    email: email ?? `${uid}@example.com`,
    roles,
  });
}

async function seedSuper(uid = "super-1"): Promise<void> {
  await seedUser(uid, { user: true, admin: true, super: true });
}

function auditEntries(): Array<Record<string, unknown>> {
  const raw = (fakeDb.store["roleAudit"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return Object.values(raw);
}

describe("changeUserRole", () => {
  beforeEach(() => resetFakeState());

  it("rejects an unauthenticated caller", async () => {
    await expect(
      invoke(
        { uid: "target-1", roles: { user: true, admin: false, super: false } },
        null
      )
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects an admin who is not super", async () => {
    await seedUser("admin-1", { user: true, admin: true, super: false });

    await expect(
      invoke(
        { uid: "target-1", roles: { user: true, admin: true, super: false } },
        { uid: "admin-1", token: { email: "admin@example.com" } }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects malformed desired roles", async () => {
    await seedSuper();
    await seedUser("target-1", { user: true });

    await expect(invoke({ uid: "target-1", roles: {} })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(
      invoke({ uid: "target-1", roles: { user: true, admin: "yes", super: false } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("treats a revoked member as a ban with no surviving privilege", async () => {
    await seedSuper();
    await seedUser("target-1", { user: true, admin: true });

    await invoke({
      uid: "target-1",
      roles: { user: false, admin: true, super: true },
    });

    expect(fakeDb.read("users/target-1/roles")).toEqual({
      user: false,
      admin: false,
      super: false,
    });
  });

  it("rejects a missing target", async () => {
    await seedSuper();

    await expect(
      invoke({ uid: "missing", roles: { user: true, admin: false, super: false } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("grants a role and writes exactly one audit row from server values", async () => {
    await seedSuper();
    await seedUser("target-1", { user: true }, "target@example.com");

    await expect(
      invoke({
        uid: "target-1",
        roles: { user: true, admin: true, super: false },
        actorId: "attacker",
        actorEmail: "evil@example.com",
        at: 0,
      })
    ).resolves.toMatchObject({
      ok: true,
      before: { user: true, admin: false, super: false },
      after: { user: true, admin: true, super: false },
    });

    expect(fakeDb.read("users/target-1/roles")).toEqual({
      user: true,
      admin: true,
      super: false,
    });
    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: "super-1",
      actorEmail: "super@example.com",
      targetId: "target-1",
      targetEmail: "target@example.com",
      before: { user: true, admin: false, super: false },
      after: { user: true, admin: true, super: false },
    });
    expect(audits[0].at).not.toBe(0);
    expect(typeof audits[0].at).toBe("number");
  });

  it("revokes membership and audits the ban", async () => {
    await seedSuper();
    await seedUser("target-1", { user: true });

    await invoke({
      uid: "target-1",
      roles: { user: false, admin: false, super: false },
    });

    expect(fakeDb.read("users/target-1/roles")).toEqual({
      user: false,
      admin: false,
      super: false,
    });
    expect(auditEntries()[0]).toMatchObject({
      before: { user: true, admin: false, super: false },
      after: { user: false, admin: false, super: false },
    });
  });

  it("normalizes super to imply admin", async () => {
    await seedSuper();
    await seedUser("target-1", { user: true });

    await invoke({
      uid: "target-1",
      roles: { user: true, admin: false, super: true },
    });

    expect(fakeDb.read("users/target-1/roles")).toEqual({
      user: true,
      admin: true,
      super: true,
    });
  });

  it("refuses to demote the last super", async () => {
    await seedSuper();

    await expect(
      invoke({
        uid: "super-1",
        roles: { user: true, admin: true, super: false },
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(fakeDb.read("users/super-1/roles")).toEqual({
      user: true,
      admin: true,
      super: true,
    });
    expect(auditEntries()).toHaveLength(0);
  });

  it("allows demoting a super when another super remains", async () => {
    await seedSuper();
    await seedUser("super-2", { user: true, admin: true, super: true });

    await invoke({
      uid: "super-2",
      roles: { user: true, admin: true, super: false },
    });

    expect(fakeDb.read("users/super-2/roles")).toEqual({
      user: true,
      admin: true,
      super: false,
    });
    expect(auditEntries()).toHaveLength(1);
  });

  it("leaves neither a role grant nor an audit row when the atomic write fails", async () => {
    await seedSuper();
    await seedUser("target-1", { user: true });
    const originalRef = fakeDb.ref.bind(fakeDb);
    const refSpy = vi.spyOn(fakeDb, "ref").mockImplementation(((
      path: string
    ) => {
      if (!path) {
        return {
          update: () => Promise.reject(new Error("db down")),
        } as never;
      }
      return originalRef(path);
    }) as never);

    await expect(
      invoke({
        uid: "target-1",
        roles: { user: true, admin: true, super: false },
      })
    ).rejects.toThrow("db down");

    refSpy.mockRestore();
    expect(fakeDb.read("users/target-1/roles")).toEqual({ user: true });
    expect(auditEntries()).toHaveLength(0);
  });
});
