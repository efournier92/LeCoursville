import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";

interface Roles {
  user: boolean;
  admin: boolean;
  super: boolean;
}

interface UserRecord {
  email?: string;
  roles?: Partial<Roles>;
}

function toRoles(raw: unknown): Roles {
  const roles = (raw ?? {}) as Partial<Roles>;
  const superRole = roles.super === true;
  return {
    user: roles.user === true,
    admin: roles.admin === true || superRole,
    super: superRole,
  };
}

/** Normalizes and validates desired roles; null means the payload is invalid. */
function parseRoles(raw: unknown): Roles | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const input = raw as Record<string, unknown>;
  for (const key of ["user", "admin", "super"]) {
    if (typeof input[key] !== "boolean") {
      return null;
    }
  }
  const roles = toRoles(input);
  // A revoked member is a ban: no privilege can survive without membership.
  if (!roles.user) {
    roles.admin = false;
    roles.super = false;
  }
  return roles;
}

async function superCount(): Promise<number> {
  const users = ((await getDatabase().ref("users").get()).val() ??
    {}) as Record<string, UserRecord>;
  return Object.values(users).filter((user) => user?.roles?.super === true)
    .length;
}

export const changeUserRole = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const actorUid = request.auth?.uid;
    if (!actorUid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const actorRole = await getDatabase()
      .ref(`users/${actorUid}/roles/super`)
      .get();
    if (actorRole.val() !== true) {
      throw new HttpsError("permission-denied", "Super admin access required.");
    }

    const data = (request.data ?? {}) as Record<string, unknown>;
    const targetUid = typeof data.uid === "string" ? data.uid.trim() : "";
    const after = parseRoles(data.roles);
    if (!targetUid || !after) {
      throw new HttpsError("invalid-argument", "Invalid role change.");
    }

    const db = getDatabase();
    const targetSnap = await db.ref(`users/${targetUid}`).get();
    const target = (targetSnap.val() ?? null) as UserRecord | null;
    if (!target) {
      throw new HttpsError("not-found", "User not found.");
    }
    const before = toRoles(target.roles);

    if (before.super && !after.super && (await superCount()) <= 1) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot demote the last super admin."
      );
    }

    const auditRef = db.ref("roleAudit").push();
    const audit = {
      actorId: actorUid,
      actorEmail: request.auth?.token?.email || null,
      targetId: targetUid,
      targetEmail: target.email || null,
      before,
      after,
      at: Date.now(),
    };

    // Multi-path update: RTDB applies the role grant and its audit together,
    // so a failed write cannot leave either one behind.
    const updates: Record<string, unknown> = {
      [`users/${targetUid}/roles`]: after,
      [`roleAudit/${auditRef.key}`]: audit,
    };
    await db.ref().update(updates);

    // Mirror approval into the auth token and force it to take effect now
    // rather than when the current refresh token expires.
    await getAuth().setCustomUserClaims(targetUid, { approved: after.user === true });
    await getAuth().revokeRefreshTokens(targetUid);

    return { ok: true, before, after };
  }
);
