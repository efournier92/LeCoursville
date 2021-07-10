import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { ChatService } from 'src/app/services/chat.service';
import { User } from 'src/app/models/user';
import { Message } from 'src/app/models/message';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
  user: User;
  messages: Message[];
  url: string;
  loading: boolean = true;
  years: Number[];

  constructor(
    private chatService: ChatService,
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  ngOnInit(): void {
    this.chatService.chatObservable.subscribe(
      (messages: Message[]) => {
        this.messages = messages.sort(this.compareMessagesByTimestamp);
        this.bumpStickies();
      }
    )
  }

  bumpStickies(): any {
    let stickyMessages = this.messages.filter(message => message.isSticky === true).reverse();
    this.messages = this.messages.filter(message => message.isSticky !== true);
    for (const message of stickyMessages) {
      this.messages.unshift(message);
    }
  }

  compareMessagesByTimestamp(a: Message, b: Message): number {
    return new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime()
  }

  compareMessagesByLikes(a: Message, b: Message): any {
    if (!a.likes)
      a.likes = [];
    if (!b.likes)
      b.likes = [];
    return b.likes.length - a.likes.length;
  }

  getUserNameById(userId: string): void {
    this.auth.getUserNameById(userId);
  }

  createMessage(): void {
    for (let message of this.messages) {
      if (message.isEditable === true)
        return;
    }
    let authorId: string = this.user.id;
    let authorName: string = this.user.name;
    this.messages.unshift(new Message('', '', '', authorId, authorName, false, true, 0));
  }

  loadMore(): void {
    this.chatService.getMessages().valueChanges().subscribe(
      (messages: Message[]) => {
        this.messages = messages.sort(this.compareMessagesByTimestamp);
      }
    );
  }

  updateMessage(message: Message): void {
    message.isEditable = false;
    this.chatService.updateMessage(message);
  }

  updateMessages(message: Message): void {
    this.chatService.updateMessage(message);
  }

  deleteMessage(message: Message): void {
    this.chatService.deleteMessage(message);
  }

  cancelEdit(message): void {
    if (!message.isSaved) {
      this.messages.shift();
    } else {
      message.isEditable = false;
    }
  }
}
