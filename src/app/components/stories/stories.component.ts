import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { StoriesService } from './stories.service';
import { User } from 'src/app/components/auth/user';
import { Message } from 'src/app/components/chat/message';
import { MatDialog } from '@angular/material';
import { NamePrompt } from '../auth/name-prompt/name-prompt';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class StoriesComponent implements OnInit {
  user: User;
  messages: Message[];
  url: string;
  loading: boolean = true;
  years: Number[];

  constructor(
    private chatService: StoriesService,
    private auth: AuthService,
    public namePrompt: MatDialog,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        // if (user.id && !user.name)
        //   this.openNamePrompt();
      }
    )
  }

  ngOnInit(): void {
    this.chatService.chatObservable.subscribe(
      (messages: Message[]) => {
        this.messages = messages.sort(this.compareMessagesByTimestamp);
      }
    )
  }

  compareMessagesByTimestamp(a: Message, b: Message): any {
    return b.timestamp - a.timestamp
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

  addMessage(): void {
    for (let message of this.messages) {
      if (message.isEditable === true)
        return;
    }
    let authorId: string = this.auth.user.id;
    let authorName: string = this.auth.user.name;
    this.messages.unshift(new Message('', '', authorId, authorName, false, true, 0));
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

  openNamePrompt(): void {
    const namePromptRef = this.namePrompt.open(NamePrompt, {
      data: { name: 'this.name', animal: 'this.animal' }
    });

    namePromptRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
    });
  }

  cancelEdit(message): void {
    if (!message.isSaved) {
      this.messages.shift();
    } else {
      message.isEditable = false;
    }
  }
}
