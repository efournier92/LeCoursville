import { SortSettings, SortProperty } from "src/app/models/sort-settings";

export class SortSettingsForExpressions extends SortSettings {
  sortableProperties: SortProperty[] = [
    this.availableSortProperties.random,
    this.availableSortProperties.title,
    this.availableSortProperties.body,
    this.availableSortProperties.attribution,
    this.availableSortProperties.yearWritten,
    this.availableSortProperties.dateSent,
  ];

  constructor() {
    super();

    this.itemsPerPage = 10;
    this.activeSortProperty = this.getSortPropertyByKey(
      this.availableSortProperties.random.key,
    );
  }

  getItemsToDisplay(items: any[], shouldResort = true): any[] {
    if (!items?.length) {
      return items;
    }

    items = this.filterItemsByParams(items);
    items = this.filterItems(items);
    if (shouldResort) items = this.sortItems(items);

    return items;
  }
}
