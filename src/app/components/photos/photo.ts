export class Photo {
    id: string;
    path: string;
    extension: string;
    url: string;
    info: string;
    year: number;

    constructor() {
        this.id = '';
        this.path = '';
        this.extension = '';
        this.url = '';
        this.info = '';
        this.year = 0;
    }
}
