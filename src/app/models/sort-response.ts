import { SortSettings } from 'src/app/models/sort-settings';
import { User } from 'src/app/models/user';

export class SortResponse {
    users: User[];
    settings: SortSettings;

    constructor(users: User[], sortAttributes: SortSettings) {
      this.users = users;
      this.settings = sortAttributes;
    }
}
