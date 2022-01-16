import { Injectable } from '@angular/core';
import { SortingConstants, SortProperty } from 'src/app/constants/sorting-constants';
import { SortSettings as SortSettings } from 'src/app/models/sort-settings';
import { User } from 'src/app/models/user';
import { SortResponse } from 'src/app/models/sort-response';

@Injectable({
  providedIn: 'root'
})
export class UserSortService {
  sortProperty: string;

  constructor() { }

  sort(users: User[], settings: SortSettings): SortResponse {
    this.sortProperty = settings.sortProperty;

    const output = new SortResponse([], settings);

    if (!users?.length) { return output; }

    output.users = users.sort(this.getSortFunction(settings));

    return output;
  }

  private getSortFunction(settings: SortSettings) {
    if (this.isTextAscending(settings.direction, settings.sortProperty)) {
      return (a: User, b: User) => a[settings.sortProperty] > b[settings.sortProperty] ? -1 : 1;
    } else if (this.isTextDescending(settings.direction, settings.sortProperty)) {
      return (a: User, b: User) => b[settings.sortProperty] > a[settings.sortProperty] ? -1 : 1;
    } else if (this.isDateAscending(settings.direction, settings.sortProperty)) {
      return (a: User, b: User) => new Date(a[settings.sortProperty]).getTime() - new Date(b[settings.sortProperty]).getTime();
    } else if (this.isDateDescending(settings.direction, settings.sortProperty)) {
      return (a: User, b: User) => new Date(b[settings.sortProperty]).getTime() - new Date(a[settings.sortProperty]).getTime();
    } else {
      return () => 1;
    }
  }

  private isAscending(direction: string): boolean {
    return direction === SortingConstants.Directions.ascending;
  }

  private isDescending(direction: string): boolean {
    return direction === SortingConstants.Directions.descending;
  }

  private isText(sortProperty: string) {
    const prop: SortProperty = SortingConstants.Users.properties[sortProperty];
    return prop.type === SortingConstants.Types.string;
  }

  private isDate(sortProperty: string) {
    const prop: SortProperty = SortingConstants.Users.properties[sortProperty];
    return prop.type === SortingConstants.Types.date;
  }

  private isTextAscending(direction: string, sortProperty: string) {
    return this.isText(sortProperty) && this.isAscending(direction);
  }

  private isTextDescending(direction: string, sortProperty: string) {
    return this.isText(sortProperty) && this.isDescending(direction);
  }

  private isDateAscending(direction: string, sortProperty: string) {
    return this.isDate(sortProperty) && this.isAscending(direction);
  }

  private isDateDescending(direction: string, sortProperty: string) {
    return this.isDate(sortProperty) && this.isDescending(direction);
  }
}
