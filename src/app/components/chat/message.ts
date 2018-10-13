export class Message {
	id: string;
	title: string;
	body: string;
	authorName: string;
	authorId: string;
	timestamp: number;
	likes: string[];

	constructor(title, body, authorId, authorName) {
		this.title = title;
		this.body = body;
		this.authorId = authorId;
		this.authorName = authorName;
		this.timestamp = new Date().getTime();
		this.likes = new Array<string>();
	}
}
