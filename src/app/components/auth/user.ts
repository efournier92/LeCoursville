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

    constructor(authData: any) {
        this.id = authData.uid;
        this.email = authData.email;
        this.roles = { user: true };
    }
}