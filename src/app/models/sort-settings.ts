import { SortingConstants, SortProperty } from 'src/app/constants/sorting-constants';

export abstract class SortSettings {
  direction: string;
  sortProperties: Object;
  sortProperty: string;
  filterQuery: string = '';
  itemsPerPage: number = 20;
  currentPageIndex: number = 0;
  totalItems: number = 0;
  totalFilteredItems: number = 0;

  constructor(
    direction: string,
    sortProperty: string,
    filterQuery: string,
    itemsPerPage: number,
    currentPageIndex: number,
  ) {
    this.direction = direction;
    this.sortProperty = sortProperty;
    this.filterQuery = filterQuery;
    this.itemsPerPage = itemsPerPage;
    this.currentPageIndex = currentPageIndex;
  }

  // PUBLIC METHODS

  filterItems(items: any[]): any[] {
    if (!items.length) { return items; }

    const filteredItems = items.filter(
      (item: any) => {
        const queryProperties = this.getQueryProperties(item);
        return this.doesAnyValueIncludeQuery(queryProperties);
      }
    );

    this.totalItems = filteredItems.length

    return filteredItems;
  }

  sortItems(items: any[]): any[] {
    this.sortProperty = this.sortProperty;

    return items.sort(this.getSortFunction());
  }

  getItemsToDisplay(itemsToSort: any[]): any[] {
    console.error('Function not implemented on base class')

    return itemsToSort;
  }

  getPaginatedItems(items: any[]): any[] {
    let output: any[];

    const start = this.currentPageIndex === 0 ? 0 : this.currentPageIndex * this.itemsPerPage;
    const end = start + this.itemsPerPage;

    if (items.length) {
      output = items?.slice(start, end);
    }

    return output;
  }

  // HELPER METHODS

  private doesAnyValueIncludeQuery(values: string[]): boolean {
    let filteredItems = false;

    for (const value of values) {
      if (this.doesValueIncludeQuery(value)) {
        filteredItems = true;
        break;
      }
    }

    return filteredItems;
  }

  doesValueIncludeQuery(value: string): boolean {
    return value.toLowerCase().includes(this.filterQuery.toLocaleLowerCase());
  }

  reverseSortDirection(): void {
    this.direction =
      this.direction === SortingConstants.Directions.ascending
        ? SortingConstants.Directions.descending
        : SortingConstants.Directions.ascending;
  }

  private getQueryProperties(item: any): any[] {
    const queryProperties = [];

    Object.keys(this.sortProperties).forEach(property => {
      queryProperties.push(item[property]);
    });

    return queryProperties;
  }

  // SORT FUNCTIONS

  private getSortFunction() {
    if (this.isTextAscending(this.direction, this.sortProperty)) {
      return (a: any, b: any) => a[this.sortProperty] > b[this.sortProperty] ? -1 : 1;
    } else if (this.isTextDescending(this.direction, this.sortProperty)) {
      return (a: any, b: any) => b[this.sortProperty] > a[this.sortProperty] ? -1 : 1;
    } else if (this.isDateAscending(this.direction, this.sortProperty)) {
      return (a: any, b: any) => new Date(a[this.sortProperty]).getTime() - new Date(b[this.sortProperty]).getTime();
    } else if (this.isDateDescending(this.direction, this.sortProperty)) {
      return (a: any, b: any) => new Date(b[this.sortProperty]).getTime() - new Date(a[this.sortProperty]).getTime();
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
    const prop: SortProperty = this.sortProperties[sortProperty];
    return prop.type === SortingConstants.Types.string;
  }

  private isDate(sortProperty: string) {
    const prop: SortProperty = this.sortProperties[sortProperty];
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
