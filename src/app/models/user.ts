export interface AuthRoles {
  user: boolean;
  admin?: boolean;
  super?: boolean;
}

export class User {
  id: string;
  name: string;
  email: string;
  roles: AuthRoles;
  dateRegistered: Date;
  dateLastActive: Date;

  constructor(authData: any, existingUser: User) {
    const authUser = authData?.authResult?.user || authData;

    this.id = existingUser?.id || authUser?.uid;
    this.name = existingUser?.name || authUser?.displayName;
    this.email = existingUser?.email || authUser?.email;
    this.dateRegistered = existingUser?.dateRegistered || authUser?.metadata?.creationTime;
    this.dateLastActive = authUser?.metadata.lastSignInTime;
    this.roles = existingUser?.roles || { user: true, admin: false, super: false };
  }
}
