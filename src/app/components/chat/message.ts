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
	replyLevel: number;

	constructor(title, body, authorId, authorName, isReply, editable, replyLevel) {
		this.title = title;
		this.body = body;
		this.authorId = authorId;
		this.authorName = authorName;
		this.likes = new Array<string>();
		this.isReply = isReply;
		this.replyLevel = replyLevel;
		this.replies = new Array<Message>();
		this.timestamp = new Date().getTime();
		this.editable = editable;
	}
}
