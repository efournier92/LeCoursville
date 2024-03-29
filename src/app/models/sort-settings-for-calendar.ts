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
  sortableProperties: SortProperty[] = [
    this.availableSortProperties.title,
    this.availableSortProperties.type,
    this.availableSortProperties.date,
  ];

  constructor() {
    super();

    this.itemsPerPage = 48
    this.activeSortProperty = this.getSortPropertyByKey(this.availableSortProperties.date.key);

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

  // PUBLIC METHODS

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

  // HELPER METHODS

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

