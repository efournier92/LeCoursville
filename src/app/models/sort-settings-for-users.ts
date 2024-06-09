import { SortSettings } from 'src/app/models/sort-settings';

export class SortSettingsForUsers extends SortSettings {
  sortableProperties = [
    this.availableSortProperties.id,
    this.availableSortProperties.name,
    this.availableSortProperties.email,
    this.availableSortProperties.dateLastActive,
    this.availableSortProperties.dateRegistered,
  ];

  constructor() {
    super();

    this.itemsPerPage = 24;
    this.activeSortProperty = this.getSortPropertyByKey(
      this.availableSortProperties.dateLastActive.key,
    );
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
