export class Message {
	id: string;
	title: string;
	body: string;
	author: string;
	timestamp: number;
	likes: string[];

	constructor(author, title, body) {
		this.title = title;
		this.body = body;
		this.author = author;
		this.timestamp = new Date().getTime();
		
		this.likes = new Array<string>();
	}
}
