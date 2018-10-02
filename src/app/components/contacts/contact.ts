export class Phone {
    number: string = '';
    type: string = '';
}

export class Contact {
    id: string = '';
    name: string = '';
    family: string = '';
    emails: string[] = ['', ''];
    street: string = '';
    city: string = '';
    state: string = '';
    zip: string = '';
    info: string = '';
    phones: Phone[] = [new Phone(), new Phone()];
    editable: boolean = false;

    constructor() { }
}
