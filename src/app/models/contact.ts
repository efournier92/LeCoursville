export class Address {
  street = '';
  city = '';
  state = '';
  zip = '';
  info = '';
}

export class Phone {
  number = '';
  info = '';
}

export class Email {
  address = '';
  info = '';
}

export class Contact {
  id = '';
  name = '';
  addresses: Address[] = [];
  family = '';
  emails: Email[] = [];
  phones: Phone[] = [];
  isEditable = false;
}
