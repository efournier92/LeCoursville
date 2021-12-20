export class Media {
    id: string;
    name: string;
    url: string;
    date: string;
    author: string;
    fileName: string;
    type: string;
    listing: Array<any>;
    format: string;
    dateUpdated: Date;
    ids: {
        location: string,
        icon: string,
        download: string
    };
    urls: {
        location: string,
        icon: string,
        download: string
    };

    constructor(
        id: string = "",
        name: string = "",
        locationId: string = "",
        iconId: string = "",
        downloadId: string = "",
        date: string = "",
        author: string = "",
        fileName: string = "",
        type: string = "",
        listing: Array<any> = [],
        format: string = "",
        dateUpdated: Date = new Date(),
    ) {
        this.id = id,
        this.name = name,
        this.date = date,
        this.author = author,
        this.fileName = fileName,
        this.type = type,
        this.listing = listing,
        this.format = format,
        this.dateUpdated = dateUpdated,
        this.ids = {
            location: locationId,
            icon: iconId,
            download: downloadId,
        },
        this.urls = {
            location: "",
            icon: "",
            download: "",
        }
    }
}
