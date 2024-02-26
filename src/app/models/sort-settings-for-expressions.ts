import { SortSettings, SortProperty } from 'src/app/models/sort-settings';

export class SortSettingsForExpressions extends SortSettings {
  // TODO: SortProperties should be restructured as an iterable
  sortProperties = {
    title: new SortProperty('title', 'Title', this.types.string),
    body: new SortProperty('body', 'Body', this.types.string),
    // authorName: new SortProperty('authorName', 'Author', this.types.string),
    attribution: new SortProperty('attribution', 'Attribution', this.types.string),
    yearWritten: new SortProperty('yearWritten', 'Year Written', this.types.string),
    dateSent: new SortProperty('dateSent', 'Date Created', this.types.date),
  };

  constructor() {
    const sortDirection = '';
    const sortProperty = '';
    const filterQuery = '';
    const itemsPerPage = 10;
    const currentPageIndex = 0;

    super(sortDirection, sortProperty, filterQuery, itemsPerPage, currentPageIndex);

    this.direction = this.directions.descending;
    this.sortProperty = this.sortProperties.dateSent.key;
    // TODO: This should happen at a parent level
    this.sortPropertyTitles = this.getSortPropertyTitles();
    this.sortPropertyTitle = "Random"
    // TODO: This feels hacky and should be done better
    this.isRandom = true;
  }

  getItemsToDisplay(itemsToSort: any[]): any[] {
    let items: any[];

    if (!itemsToSort?.length) {
      return itemsToSort;
    }

    items = this.filterItems(itemsToSort);
    items = this.sortItems(items);

    return items;
  }
}
