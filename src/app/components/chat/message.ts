export class Message {
	id: string;
	title: string;
	body: string;
	author: string;
	date: Date;
	likes: string[];

	constructor(author, title, body) {
		this.title = title;
		this.body = body;
		this.author = author;
		this.date = new Date();
		this.likes = new Array<string>();
	}
}
