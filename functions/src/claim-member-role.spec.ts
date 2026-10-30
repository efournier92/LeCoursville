import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import { claimMemberRole } from "./claim-member-role";
import { fakeDb, resetFakeState } from "./test-support";

const auth = {
  uid: "member-1",
  token: { email: "member@example.com" },
  rawToken: "token",
};

function invoke(data: Record<string, unknown> = {}, caller: unknown = auth) {
  return claimMemberRole.run({ data, auth: caller, rawRequest: {} } as never);
}

describe("claimMemberRole", () => {
  beforeEach(() => resetFakeState());

  it("rejects an unauthenticated caller", async () => {
    await expect(invoke({}, null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("does not grant roles/user, ignoring spoofed input", async () => {
    await fakeDb.ref("users/member-1/roles/admin").set(true);

    await expect(invoke({ uid: "someone-else" })).resolves.toEqual({
      ok: true,
      uid: "member-1",
    });

    expect(fakeDb.read("users/member-1/roles/user")).toBeNull();
    expect(fakeDb.read("users/member-1/roles/admin")).toBe(true);
    expect(fakeDb.read("users/someone-else")).toBeNull();
  });

  it("is idempotent and leaves existing roles untouched", async () => {
    await fakeDb.ref("users/member-1/roles/super").set(true);

    await invoke();
    await invoke();

    expect(fakeDb.read("users/member-1/roles")).toEqual({ super: true });
  });
});
