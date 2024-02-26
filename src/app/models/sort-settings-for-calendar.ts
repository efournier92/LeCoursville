import { SortSettings, SortProperty } from 'src/app/models/sort-settings';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

class DisplayToggle {
  id: string;
  name: string;
  isToggled: boolean;
  conditionalPropertyKey: string;
  conditionalPropertyOperator: string;
  conditionalPropertyValue: string;
}

export class SortSettingsForCalendar extends SortSettings {
  displayToggles: DisplayToggle[];
  displayToggleStates: Object;
  sortProperties = {
    title: new SortProperty('title', 'Title', this.types.string),
    type: new SortProperty('type', 'Type', this.types.string),
    date: new SortProperty('date', 'Date', this.types.date),
  };

  constructor() {
    const sortDirection = '';
    const sortProperty = '';
    const filterQuery = '';
    const itemsPerPage = 48;
    const currentPageIndex = 0;

    super(sortDirection, sortProperty, filterQuery, itemsPerPage, currentPageIndex);

    this.direction = this.directions.descending;
    this.sortProperty = this.sortProperties.date.key;

    this.displayToggles = [
      {
        id: 'birthday',
        name: 'Birthday',
        isToggled: true,
        conditionalPropertyKey: 'type',
        conditionalPropertyOperator: '&&',
        conditionalPropertyValue: "'birth'",
      },
      {
        id: 'anniversary',
        name: 'Anniversary',
        isToggled: true,
        conditionalPropertyKey: 'type',
        conditionalPropertyOperator: '||',
        conditionalPropertyValue: "'anniversary'",
      },
      {
        id: 'living',
        name: 'Is Living',
        isToggled: true,
        conditionalPropertyKey: 'isLiving',
        conditionalPropertyOperator: '&&',
        conditionalPropertyValue: "true",
      },
    ];

    this.displayToggleStates = {};
    this.displayToggles.forEach((toggle) => {
      this.displayToggleStates[toggle.id] = toggle.isToggled;
    });
  }

  getItemsToDisplay(itemsToSort: RecurringEvent[]): RecurringEvent[] {
    let items: RecurringEvent[];

    if (!itemsToSort?.length) {
      return itemsToSort;
    }

    items = this.filterItems(itemsToSort);
    items = this.filterItemsByToggles(items);
    items = this.sortItems(items);
    items = this.getPaginatedItems(items);

    return items;
  }

  public getToggleQuery(): string {
    let toggleQuery: string = 'true';

    toggleQuery = this.getTypeToggleQuery(toggleQuery);
    toggleQuery = this.getOtherToggleQuery(toggleQuery);

    return toggleQuery;
  }

  public filterItemsByToggles(items: RecurringEvent[]): RecurringEvent[] {
    const toggleQuery = this.getToggleQuery()

    return items.filter(event => eval(toggleQuery))
  }

  private getTypeToggleQuery(toggleQuery): string {
    const typeToggles = this.displayToggles.filter(toggle => toggle.conditionalPropertyKey === 'type');

    if (typeToggles.length) {
      typeToggles.forEach((toggle, index) => {
        if (index === 0) {
          toggleQuery += ` ${toggle.conditionalPropertyOperator} (`;
        } else {
          toggleQuery += ` ${toggle.conditionalPropertyOperator}`;
        }
        const operator = toggle.isToggled ? '===' : '!==';
        toggleQuery += ` event['${toggle.conditionalPropertyKey}'] ${operator} ${toggle.conditionalPropertyValue}`
      })
      toggleQuery += ` )`;
    }

    return toggleQuery;
  }

  private getOtherToggleQuery(toggleQuery): string {
    const otherToggles = this.displayToggles.filter(toggle => toggle.conditionalPropertyKey !== 'type');

    if (otherToggles.length) {
      otherToggles.forEach(toggle => {
        const operator = toggle.isToggled ? '===' : '!==';
        toggleQuery += ` ${toggle.conditionalPropertyOperator} event['${toggle.conditionalPropertyKey}'] ${operator} ${toggle.conditionalPropertyValue}`
      })
    }

    return toggleQuery;
  }
}

