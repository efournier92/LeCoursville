import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import { User } from 'src/app/components/auth/user';
import { Message } from 'src/app/components/chat/message';
import { MatDialog } from '@angular/material';
import { NamePrompt } from '../auth/name-prompt/name-prompt';

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
    public namePrompt: MatDialog,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  ngOnInit() {
    this.chatService.chatObservable.subscribe(messages => {
      // for (const message of messages) {
      //   message.
      // }
      this.messages = messages;
      console.log(messages);
    })
  }

  getUserNameById(userId) {
    this.auth.getUserNameById(userId);
  }

  addMessage() {
    if (!this.auth.user.name) {
      this.openNamePrompt();
    }
    let authorId = this.auth.user.id;
    let authorName = this.auth.user.name;
    this.messages.unshift(new Message('', '', authorId, authorName, false, true, 0));
  }

  loadMore() {
    this.chatService.getMessages().valueChanges().subscribe(
      (messages: Message[]) => {
        this.messages = messages;
      }
    );
  }

  updateMessage(message) {
    message.editable = false;
    this.chatService.updateMessage(message);
  }

  updateMessages(message) {
    this.chatService.updateMessage(message);
  }

  deleteMessage(message) {
    this.chatService.deleteMessage(message);
  }

  openNamePrompt(): void {
    console.log('hit');
    const namePromptRef = this.namePrompt.open(NamePrompt, {
      data: { name: 'this.name', animal: 'this.animal' }
    });

    namePromptRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
    });
  }

}
