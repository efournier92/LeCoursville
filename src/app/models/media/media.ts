export class Media {
    constructor(
        public id?: string,
        public title?: string,
        public artist?: string,
        public date?: string,
        public folderName?: string,
        public isHidden?: boolean,
        public listing?: Array<any>,
        public urls?: {
            icon: string,
            download: string
        },
        public type?: string,
        public format?: string,
        public dateUpdated?: Date,
    ) {
        this.id = id;
        this.title = title;
        this.date = date;
        this.artist = artist;
        this.folderName = folderName;
        this.isHidden = isHidden;
        this.listing = listing;
        this.urls = {
            icon: '',
            download: '',
        };
        this.dateUpdated = new Date();
    }
}

export interface UploadableMedia {
    id: string;
    title: string;
    artist: string;
    date: string;
    folderName: string;
    isHidden: boolean;
    listing: Array<any>;
    urls: { download: string, icon: string, };
    type: string;
    format: string;
    dateUpdated: Date;
}
