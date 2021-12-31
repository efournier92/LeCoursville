import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { ChatService } from 'src/app/services/chat.service';
import { User } from 'src/app/models/user';
import { Message } from 'src/app/models/message';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AppSettings } from 'src/environments/app-settings';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
  user: User;
  messages: Message[];
  url: string;
  loading = true;
  years: number[];

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.subscribeToChatObservable();
    this.analyticsService.logEvent('component_load_chat', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private subscribeToChatObservable(): void {
    this.chatService.chatObservable.subscribe(
      (messages: Message[]) => {
        messages = this.filterOldMessages(messages);
        this.messages = messages.sort(this.compareMessagesByTimestamp);
        this.bumpStickies();
      }
    );
  }

  // PUBLIC METHODS

  createMessage(): void {
    for (const message of this.messages) {
      if (message.isEditable === true) { return; }
    }
    const authorId: string = this.user.id;
    const authorName: string = this.user.name;
    this.messages.unshift(new Message('', '', '', authorId, authorName, false, true, 0));
    this.analyticsService.logEvent('chat_message_create', { user: this.user.id });
  }

  updateMessages(message: Message): void {
    this.chatService.updateMessage(message);
  }

  cancelEdit(message: Message): void {
    if (!message.isSaved) {
      this.messages.shift();
    } else {
      message.isEditable = false;
    }
    this.analyticsService.logEvent('chat_message_edit_cancel', { user: this.user.id });
  }

  // HELPER METHODS

  private bumpStickies(): any {
    const stickyMessages = this.messages.filter(message => message.isSticky === true).reverse();
    this.messages = this.messages.filter(message => message.isSticky !== true);
    for (const message of stickyMessages) {
      this.messages.unshift(message);
    }
  }

  private compareMessagesByTimestamp(a: Message, b: Message): number {
    return new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime();
  }

  private filterOldMessages(messages: Message[]): Message[] {
    const filtrationThesholdDate = new Date(new Date().setMonth(new Date().getMonth() - AppSettings.chat.includeMessagesFromHowManyMonths));
    return messages.filter(message => new Date(message.dateSent) > filtrationThesholdDate);
  }
}
