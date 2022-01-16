export class SortSettings {
  direction: string;
  sortProperty: string;
  filterQuery: string;
  usersPerPage: number;
  currentPageIndex: number;
  hasSorted: boolean;

  constructor(
    order: string,
    sortProperty: string,
    filterQuery: string,
    usersPerPage: number,
    currentPageIndex: number,
    hasSorted: boolean
  ) {
    this.direction = order;
    this.sortProperty = sortProperty;
    this.filterQuery = filterQuery;
    this.usersPerPage = usersPerPage;
    this.currentPageIndex = currentPageIndex;
    this.hasSorted = hasSorted;
  }
}
