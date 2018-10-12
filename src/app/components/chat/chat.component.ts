import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import { User } from 'src/app/components/auth/user';
import { Message } from 'src/app/components/chat/message';

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

  ngOnInit() {
    this.chatService.chatObservable.subscribe(messages => {
      this.messages = messages;
      console.log(messages);
    })
  }

  addMessage() {
    let author = this.auth.user.id;
    this.chatService.addMessage('Test Title', 'Test Body', author);
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

}
