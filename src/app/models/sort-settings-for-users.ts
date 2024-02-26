import { SortSettings, SortProperty } from 'src/app/models/sort-settings';

export class SortSettingsForUsers extends SortSettings {
  sortProperties = {
    id: new SortProperty('id', 'ID', this.types.string),
    name: new SortProperty('name', 'Name', this.types.string),
    email: new SortProperty('email', 'Email', this.types.string),
    dateLastActive: new SortProperty('dateLastActive', 'Date Last Active', this.types.date),
    dateRegistered: new SortProperty('dateRegistered', 'Date Registered', this.types.date),
  };

  constructor() {
    const sortDirection = '';
    const sortProperty = '';
    const filterQuery = '';
    const itemsPerPage = 10;
    const currentPageIndex = 0;

    super(sortDirection, sortProperty, filterQuery, itemsPerPage, currentPageIndex);

    this.direction = this.directions.descending;
    this.sortProperty = this.sortProperties.dateLastActive.key;
  }

  getItemsToDisplay(itemsToSort: any[]): any[] {
    let items: any[];

    if (!itemsToSort?.length) {
      return itemsToSort;
    }

    items = this.filterItems(itemsToSort);
    items = this.sortItems(items);
    items = this.getPaginatedItems(items);

    return items;
  }
}
