import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { ChatService } from 'src/app/services/chat.service';
import { User } from 'src/app/models/user';
import { Message } from 'src/app/models/message';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AppSettings } from 'src/environments/app-settings';
import { MessageConstants } from 'src/app/constants/message-constants';
import { ArrayService } from 'src/app/services/array.service';

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
    public chatService: ChatService,
    private authService: AuthService,
    public analyticsService: AnalyticsService,
    public arrayService: ArrayService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.analyticsService.logEvent('component_load_chat', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        this.subscribeToChatObservable();
      }
    );
  }

  private subscribeToChatObservable(): void {
    this.chatService.chatObservable.subscribe(
      (messages: Message[]) => {
        this.onChatObservableUpdate(messages)
      }
    );
  }

  // PUBLIC METHODS

  onChatObservableUpdate(messages: Message[]) {
    messages = this.filterRelevantMessages(messages);
    this.messages = messages.sort(this.compareMessagesByTimestamp);
    this.bumpStickies();
  }

  createMessage(): void {
    for (const message of this.messages) {
      if (message.isEditable === true) { return; }
    }
    const authorId: string = this.user.id;
    const authorName: string = this.user.name;
    this.messages.unshift(new Message('', '', '', authorId, authorName, false, true, 0));
    this.analyticsService.logEvent('chat_message_create', {
      userId: this.user?.id,
    });
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
    this.analyticsService.logEvent('chat_message_edit_cancel', {
      userId: this.user?.id,
    });
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

  private filterRelevantMessages(messages: Message[]): Message[] {
    messages = this.chatService.filterByType(messages, MessageConstants.Types.Chat);
    return this.filterOldMessages(messages)
  }

  private filterOldMessages(messages: Message[]): Message[] {
    const filtrationThesholdDate = new Date(new Date().setMonth(new Date().getMonth() - AppSettings.chat.includeMessagesFromHowManyMonths));
    return messages.filter(message => new Date(message.dateSent) > filtrationThesholdDate);
  }
}
