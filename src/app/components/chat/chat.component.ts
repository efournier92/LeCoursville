import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import { User } from 'src/app/components/auth/user';
import { Message } from 'src/app/components/chat/message';
import { MatDialog } from '@angular/material';

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
        this.messages.sort(this.compareStickies);
      }
    )
  }

  compareStickies(a: Message, b: Message): any {
    return a.isSticky == true ? -1 : b.isSticky == false ? 1 : 0;
  }

  compareMessagesByTimestamp(a: Message, b: Message): any {
    return b.timestamp - a.timestamp;
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
    let authorId: string = this.auth.user.id;
    let authorName: string = this.auth.user.name;
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
