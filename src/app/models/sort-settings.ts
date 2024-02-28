export class SortProperty {
  key: string;
  title: string;
  type: string;

  constructor(
    key: string,
    title: string,
    type: string,
  ) {
    this.key = key;
    this.title = title;
    this.type = type;
  }
}

export abstract class SortSettings {
  sortableProperties: SortProperty[];
  activeSortProperty: SortProperty;
  activeDirection: string;
  activeFilterQuery: string = '';
  activeFilterParams: Object = {};
  itemsPerPage: number = 20;
  currentPageIndex: number = 0;
  totalItems: number = 0;
  totalFilteredItems: number = 0;

  // CONSTANTS

  sortableDirections = {
    ascending: 'ASC',
    descending: 'DESC',
  };

  sortableTypes = {
    string: 'string',
    date: 'date',
    random: 'random',
  };

  availableSortProperties = {
    id: new SortProperty('id', 'ID', this.sortableTypes.string),
    title: new SortProperty('title', 'Title', this.sortableTypes.string),
    body: new SortProperty('body', 'Body', this.sortableTypes.string),
    name: new SortProperty('name', 'Name', this.sortableTypes.string),
    email: new SortProperty('email', 'Email', this.sortableTypes.string),
    type: new SortProperty('type', 'Type', this.sortableTypes.string),
    authorName: new SortProperty('authorName', 'Author', this.sortableTypes.string),
    attribution: new SortProperty('attribution', 'Attribution', this.sortableTypes.string),
    yearWritten: new SortProperty('yearWritten', 'Year Written', this.sortableTypes.string),
    date: new SortProperty('date', 'Date', this.sortableTypes.date),
    dateSent: new SortProperty('dateSent', 'Date Created', this.sortableTypes.date),
    dateLastActive: new SortProperty('dateLastActive', 'Date Last Active', this.sortableTypes.date),
    dateRegistered: new SortProperty('dateRegistered', 'Date Registered', this.sortableTypes.date),
    random: new SortProperty('random', 'Random', this.sortableTypes.random),
  };

  constructor() {
    this.activeDirection = this.sortableDirections.descending;
    this.currentPageIndex = 0;
  }

  // PUBLIC METHODS

  filterItems(items: any[]): any[] {
    if (!items.length) { return items; }

    const filteredItems = items.filter(
      (item: any) => {
        const queryProperties = this.getAllQueryProperties(item);
        return this.doesAnyValueIncludeQuery(queryProperties);
      }
    );

    this.totalItems = filteredItems.length

    return filteredItems;
  }

  filterItemsByParams(items: any[]): any[] {
    if (!Object.keys(this.activeFilterParams).length || !items.length) { return items; }

    const relevantProperties = Object.keys(this.activeFilterParams);

    const filteredItems = items.filter(
      (item: any) => {
        let isMatch = false;
        Object.entries(this.activeFilterParams).forEach(([key, value]) => {
          isMatch = isMatch || item[key]?.toLowerCase().includes(value.toLowerCase());
        })
        return isMatch;
      }
    );

    this.totalItems = filteredItems.length

    return filteredItems;
  }

  hasActiveFilterParams(): boolean {
    return this.activeFilterParams
      && Object.keys(this.activeFilterParams).length > 0
  }

  sortItems(items: any[]): any[] {
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

  getSortPropertyByKey(key): SortProperty {
    return this.sortableProperties.find(prop => prop.key === key);
  }

  doesValueIncludeQuery(value: string): boolean {
    return value.toLowerCase().includes(this.activeFilterQuery.toLocaleLowerCase());
  }

  reverseSortDirection(): void {
    this.activeDirection =
      this.activeDirection === this.sortableDirections.ascending
        ? this.sortableDirections.descending
        : this.sortableDirections.ascending;
  }

  isSortDescending(): boolean {
    return this.activeDirection === this.sortableDirections.descending
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

  // HELPER METHODS

  private getAllQueryProperties(item: any): any[] {
    return this.sortableProperties
      .map(prop => item[prop.key])
      .filter(el => el !== undefined);
  }

  private getRelevantQueryProperties(item: any, relevantProperties: string[]): any[] {
    return this.sortableProperties
      .filter(prop => relevantProperties.includes(prop.key))
      .map(prop => item[prop.key])
      .filter(el => el !== undefined);
  }
  // SORT METHODS

  private getSortFunction() {
    const activeSortPropertyKey = this.activeSortProperty.key;
    if (this.isRandom()) {
      return () => Math.random() - 0.5;
    } else if (this.isTextAscending(this.activeDirection, activeSortPropertyKey)) {
      return (a: any, b: any) => a[activeSortPropertyKey] > b[activeSortPropertyKey] ? -1 : 1;
    } else if (this.isTextDescending(this.activeDirection, activeSortPropertyKey)) {
      return (a: any, b: any) => b[activeSortPropertyKey] > a[activeSortPropertyKey] ? -1 : 1;
    } else if (this.isDateAscending(this.activeDirection, activeSortPropertyKey)) {
      return (a: any, b: any) => new Date(a[activeSortPropertyKey]).getTime() - new Date(b[activeSortPropertyKey]).getTime();
    } else if (this.isDateDescending(this.activeDirection, activeSortPropertyKey)) {
      return (a: any, b: any) => new Date(b[activeSortPropertyKey]).getTime() - new Date(a[activeSortPropertyKey]).getTime();
    } else {
      return () => 1;
    }
  }

  private isRandom(): boolean {
    return this.activeSortProperty.key === 'random';
  }

  private isAscending(direction: string): boolean {
    return direction === this.sortableDirections.ascending;
  }

  private isDescending(direction: string): boolean {
    return direction === this.sortableDirections.descending;
  }

  private isText(key: string) {
    const prop: SortProperty = this.getSortPropertyByKey(key);
    return prop.type === this.sortableTypes.string;
  }

  private isDate(key: string) {
    const prop: SortProperty = this.getSortPropertyByKey(key);
    return prop.type === this.sortableTypes.date;
  }

  private isTextAscending(direction: string, activeSortProperty: string) {
    return this.isText(activeSortProperty) && this.isAscending(direction);
  }

  private isTextDescending(direction: string, activeSortProperty: string) {
    return this.isText(activeSortProperty) && this.isDescending(direction);
  }

  private isDateAscending(direction: string, activeSortProperty: string) {
    return this.isDate(activeSortProperty) && this.isAscending(direction);
  }

  private isDateDescending(direction: string, activeSortProperty: string) {
    return this.isDate(activeSortProperty) && this.isDescending(direction);
  }
}
