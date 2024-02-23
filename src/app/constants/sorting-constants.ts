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

export abstract class SortingConstants {
  static readonly Directions = {
    ascending: 'ASC',
    descending: 'DESC',
  };

  static readonly Types = {
    string: 'string',
    date: 'date',
  };

  static readonly Users = {
    properties: {
      id: new SortProperty('id', 'ID', this.Types.string),
      name: new SortProperty('name', 'Name', this.Types.string),
      email: new SortProperty('email', 'Email', this.Types.string),
      dateLastActive: new SortProperty('dateLastActive', 'Date Last Active', this.Types.date),
      dateRegistered: new SortProperty('dateRegistered', 'Date Registered', this.Types.date),
    },
  };

  static readonly Calendar = {
    properties: {
      title: new SortProperty('title', 'Title', this.Types.string),
      type: new SortProperty('type', 'Type', this.Types.string),
      date: new SortProperty('date', 'Date', this.Types.date),
    },
  };
}
