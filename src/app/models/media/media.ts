export class Media {
    id: string;
    title: string;
    date: string;
    artist: string;
    type: string;
    listing: Array<any>;
    format: string;
    dateUpdated: Date;
    isHidden: boolean;
    folderName: string;
    urls: {
        icon: string,
        download: string
    };

    constructor() {
        this.dateUpdated = new Date();
        this.urls = {
            download: '',
            icon: '',
        };
    }
}
