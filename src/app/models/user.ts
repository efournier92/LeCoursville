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
  dateLastSignedIn: Date;

  constructor(authData: any) {
    this.id = authData.uid;
    this.name = authData.displayName;
    this.email = authData.email;
    this.dateRegistered = authData.metadata?.creationTime;
    this.dateLastSignedIn = authData.metadata?.lastSignInTime;
    this.roles = { user: true, admin: false, super: false };
  }
}
