export class SortSettings {
  direction: string;
  sortProperty: string;
  filterQuery: string;
  usersPerPage: number;
  currentPageIndex: number;

  constructor(
    order: string,
    sortProperty: string,
    filterQuery: string,
    usersPerPage: number,
    currentPageIndex: number,
  ) {
    this.direction = order;
    this.sortProperty = sortProperty;
    this.filterQuery = filterQuery;
    this.usersPerPage = usersPerPage;
    this.currentPageIndex = currentPageIndex;
  }
}
