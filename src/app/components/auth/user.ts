export interface AuthRoles {
    user: boolean;
    admin?: boolean;
    super?: boolean;
}

export class User {
    id: string;
    email: string;
    // authData: any;
    roles: AuthRoles;

    constructor(authData: any) {
        this.id = authData.uid;
        this.email = authData.email;
        this.roles = { user: true };
        // this.authData = authData;
    }
}