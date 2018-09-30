class Phone {
    number: string;
    type: string;

    constructor(phone) {
        this.number = phone.number;
        this.type = phone.type;
    }
}

export class Contact {
    id: string;
    name: string;
    family: string;
    email: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    info: string = '';
    phones: Phone[] = [];

    constructor(contact) {
        this.name = contact.name;
        this.family = contact.family;
        this.email = contact.email;
        this.street = contact.street;
        this.city = contact.city;
        this.state = contact.state;
        this.zip = contact.zip;
        if (contact.info) this.info = contact.info;
        for (let phone of contact.phones) {
            this.phones.push(new Phone(phone));
        }
    }
}
