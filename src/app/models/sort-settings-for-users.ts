import { SortSettings } from 'src/app/models/sort-settings';
import { SortingConstants } from 'src/app/constants/sorting-constants';

export class SortSettingsForUsers extends SortSettings {
  constructor() {
    const sortDirection = SortingConstants.Directions.descending;
    const sortProperty = SortingConstants.Users.properties.dateLastActive;
    const filterQuery = '';
    const itemsPerPage = 10;
    const currentPageIndex = 0;

    super(sortDirection, sortProperty.key, filterQuery, itemsPerPage, currentPageIndex);

    this.sortProperties = SortingConstants.Users.properties;
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
