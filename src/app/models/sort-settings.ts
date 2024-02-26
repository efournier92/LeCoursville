import { ArrayService } from 'src/app/services/array.service'

export class SortProperty {
  key: string;
  value: string;
  type: string;

  constructor(
    key: string,
    value: string,
    type: string,
  ) {
    this.key = key;
    this.value = value;
    this.type = type;
  }
}

export abstract class SortSettings {
  arrayService: ArrayService = new ArrayService();

  direction: string;
  sortProperty: string;
  sortProperties: Object;
  sortableAttributes: SortProperty[];
  filterQuery: string = '';
  itemsPerPage: number = 20;
  currentPageIndex: number = 0;
  totalItems: number = 0;
  totalFilteredItems: number = 0;
  sortPropertyTitles: string[];
  sortPropertyTitle: string;
  isRandom: boolean = false;

  directions = {
    ascending: 'ASC',
    descending: 'DESC',
  };

  types = {
    string: 'string',
    date: 'date',
  };

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
    // TODO: This could be better
    if (this.isRandom) {
      return this.arrayService.shuffle(items);
    } else {
      return items.sort(this.getSortFunction());
    }
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

  // TODO: SortProperties should be restructured as an iterable
  // TODO: This should not need to happen
  getSortPropertyTitles(): string[] {
    const sortPropertyTitles: string[] = [];

    Object.keys(this.sortProperties).forEach((propertyKey: string) => {
      sortPropertyTitles.push(this.sortProperties[propertyKey].value);
    });

    return sortPropertyTitles;
  }

  setSortPropertyByTitle(title): void {
    // TODO: abstract magic string
    if (title === 'Random') {
      this.sortPropertyTitle = title;
      this.isRandom = true;
    } else {
      const property = Object.values(this.sortProperties).find((prop: SortProperty) => prop.value === title);

      this.sortPropertyTitle = title;

      this.sortProperty = property.key;

      this.isRandom = false;
    }
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
      this.direction === this.directions.ascending
        ? this.directions.descending
        : this.directions.ascending;
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
    return direction === this.directions.ascending;
  }

  private isDescending(direction: string): boolean {
    return direction === this.directions.descending;
  }

  private isText(sortProperty: string) {
    const prop: SortProperty = this.sortProperties[sortProperty];
    return prop.type === this.types.string;
  }

  private isDate(sortProperty: string) {
    const prop: SortProperty = this.sortProperties[sortProperty];
    return prop.type === this.types.date;
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
