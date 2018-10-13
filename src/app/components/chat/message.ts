export class Message {
	id: string;
	title: string;
	body: string;
	authorName: string;
	authorId: string;
	isReply: boolean;
	likes: string[];
	replies: Message[];
	timestamp: number;
	editable: boolean;

	constructor(title, body, authorId, authorName, isReply, editable) {
		this.title = title;
		this.body = body;
		this.authorId = authorId;
		this.authorName = authorName;
		this.isReply = isReply;
		this.likes = new Array<string>();
		this.replies = new Array<Message>();
		this.timestamp = new Date().getTime();
		this.editable = editable;
	}
}
