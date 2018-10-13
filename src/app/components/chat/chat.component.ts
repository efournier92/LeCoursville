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
    public dialog: MatDialog,
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
    let authorId = this.auth.user.id;
    let authorName = this.auth.user.name;
    this.chatService.addMessage('Test Title', 'Test Body', authorId, authorName);
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

  deleteMessage(message) {
    this.chatService.deleteMessage(message);
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(NamePrompt, {
      width: '250px',
      data: {name: 'this.name', animal: 'this.animal'}
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
    });
  }

}
