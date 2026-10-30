export interface AuthRoles {
  user?: boolean;
  admin?: boolean;
  super?: boolean;
}

export type Theme = 'light' | 'dark';

export interface UserPrefs {
  theme?: Theme;
}

/** Membership is server-owned; pending users simply lack roles.user. */
export function isApprovedUser(user: User | null | undefined): boolean {
  return user?.roles?.user === true
    || user?.roles?.admin === true
    || user?.roles?.super === true;
}

export class User {
  id: string;
  name: string;
  email: string;
  roles: AuthRoles;
  dateRegistered: Date;
  dateLastActive: Date;
  prefs?: UserPrefs;

  constructor(authData: any, existingUser: User) {
    const authUser = authData?.authResult?.user || authData;

    this.id = existingUser?.id || authUser?.uid;
    this.name = existingUser?.name || authUser?.displayName;
    this.email = existingUser?.email || authUser?.email;
    this.dateRegistered =
      existingUser?.dateRegistered ||
      authUser?.metadata?.creationTime ||
      new Date();
    this.dateLastActive = authUser?.metadata.lastSignInTime || new Date();
    this.roles = existingUser?.roles || {
      admin: false,
      super: false,
    };
  }
}
