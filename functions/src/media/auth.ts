import { getDatabase } from "firebase-admin/database";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

interface Roles {
  admin?: boolean;
  super?: boolean;
}

/** Reads the caller's roles once and returns the uid when media access is allowed. */
export async function requireMediaAdmin(request: CallableRequest): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const roles = ((await getDatabase().ref(`users/${uid}/roles`).get()).val() ??
    null) as Roles | null;
  if (roles?.admin !== true && roles?.super !== true) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return uid;
}
