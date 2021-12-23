import { User } from 'src/app/models/user';

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
  attachmentId: string;
  attachmentType: string;
  attachmentUrl: string;
  authorName: string;
  authorId: string;
  isReply: boolean;
  replyLevel: number;
  likes: Like[];
  replies: Message[];
  dateSent: Date;
  isEditable: boolean;
  isSaved: boolean;
  isDeleted: boolean;
  isSticky: boolean;

  constructor(
    title: string,
    body: string,
    attachmentUrl: string,
    authorId: string,
    authorName: string,
    isReply: boolean,
    isEditable: boolean,
    replyLevel: number
  ) {
    this.title = title;
    this.body = body;
    this.attachmentUrl = attachmentUrl;
    this.authorId = authorId;
    this.authorName = authorName;
    this.likes = new Array<Like>();
    this.isReply = isReply;
    this.replyLevel = replyLevel;
    this.replies = new Array<Message>();
    this.dateSent = new Date();
    this.isEditable = isEditable;
    this.isSaved = false;
    this.isDeleted = false;
    this.isSticky = false;
  }
}
