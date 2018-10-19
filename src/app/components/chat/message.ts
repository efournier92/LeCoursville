import { User } from "src/app/components/auth/user";

export class Like {
	userId: string;
	userName: string;

	constructor(user: User) {
		this.userId = user.id;
		if (user.name) {
			this.userName = user.name;
		} else {
			this.userName = user.email;
		}
	}
}

export class Message {
	id: string;
	title: string;
	body: string;
	authorName: string;
	authorId: string;
	isReply: boolean;
	likes: Like[];
	replies: Message[];
	timestamp: number;
	editable: boolean;
	replyLevel: number;
	isSaved: boolean;

	constructor(title, body, authorId, authorName, isReply, editable, replyLevel) {
		this.title = title;
		this.body = body;
		this.authorId = authorId;
		this.authorName = authorName;
		this.likes = new Array<Like>();
		this.isReply = isReply;
		this.replyLevel = replyLevel;
		this.replies = new Array<Message>();
		this.timestamp = new Date().getTime();
		this.editable = editable;
	}
}
