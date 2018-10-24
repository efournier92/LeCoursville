export class Address {
  street: string = '';
  city: string = '';
  state: string = '';
  zip: string = '';
  info: string = '';
}

export class Phone {
  number: string = '';
  info: string = '';
}

export class Email {
  address: string = '';
  info: string = '';
}

export class Contact {
  id: string = '';
  name: string = '';
  addresses: Address[] = [];
  family: string = '';
  emails: Email[] = [];
  phones: Phone[] = [];
  editable: boolean = false;

  constructor() { }
}
