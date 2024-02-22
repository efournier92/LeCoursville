export class SortSettings {
  direction: string;
  sortProperty: string;
  filterQuery: string;
  itemsPerPage: number;
  currentPageIndex: number;

  constructor(
    order: string,
    sortProperty: string,
    filterQuery: string,
    itemsPerPage: number,
    currentPageIndex: number,
  ) {
    this.direction = order;
    this.sortProperty = sortProperty;
    this.filterQuery = filterQuery;
    this.itemsPerPage = itemsPerPage;
    this.currentPageIndex = currentPageIndex;
  }
}
