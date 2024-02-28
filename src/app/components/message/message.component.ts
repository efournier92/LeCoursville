import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { MessageService } from 'src/app/services/message.service';
import { User } from 'src/app/models/user';
import { Message } from 'src/app/models/message';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AppSettings } from 'src/environments/app-settings';
import { MessageConstants } from 'src/app/constants/message-constants';
import { ArrayService } from 'src/app/services/array.service';


@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss']
})
export abstract class MessageComponent implements OnInit {
  user: User;
  allItems: Message[];
  displayedItems: Message[];
  url: string;
  loading = true;
  years: number[];
  messageType: string;
  queryParams: Object;

  constructor(
    public messageService: MessageService,
    private authService: AuthService,
    public analyticsService: AnalyticsService,
    public arrayService: ArrayService,
    private activatedRoute: ActivatedRoute,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.analyticsService.logEvent(`component_load_${this.messageType}`, { });
  }

  // SUBSCRIPTIONS

  subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        this.subscribeMessagesObservable();
      }
    );
  }

  private subscribeMessagesObservable(): void {
    this.messageService.messagesObservable.subscribe(
      (messages: Message[]) => {
        this.onMessagesObservableUpdate(messages)
        this.getQueryParams();
      }
    );
  }

  // PUBLIC METHODS

  onMessagesObservableUpdate(messages: Message[]) {
    console.error("Inheriting members must define a specific implementation of the `onMessagesObservableUpdate` method.");
    messages = this.filterRelevantMessages(messages);
    this.allItems = messages.sort(this.compareMessagesByTimestamp);
    this.bumpStickies();
  }

  onCreate(): void {
    console.error("Inheriting members must define a specific implementation of the `createMessage` method.");
  }

  updateMessages(message: Message): void {
    this.messageService.updateMessage(message);
  }

  cancelEdit(message: Message): void {
    if (!message.isSaved) {
      this.allItems.shift();
    } else {
      message.isEditable = false;
    }
    this.analyticsService.logEvent('message_edit_cancel', {
      userId: this.user?.id,
      messageType: this.messageType,
    });
  }

  bumpStickies(): any {
    const stickyMessages = this.allItems.filter(message => message.isSticky === true).reverse();
    this.allItems = this.allItems.filter(message => message.isSticky !== true);
    for (const message of stickyMessages) {
      this.allItems.unshift(message);
    }
  }

  filterRelevantMessages(messages: Message[]): Message[] {
    messages = this.messageService.filterByType(messages, this.messageType);
    return this.filterOldMessages(messages)
  }

  compareMessagesByTimestamp(a: Message, b: Message): number {
    return new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime();
  }

  // HELPER METHODS

  private filterOldMessages(messages: Message[]): Message[] {
    const filtrationThesholdDate = new Date(new Date().setMonth(new Date().getMonth() - AppSettings.messages.includeMessagesFromHowManyMonths));
    return messages.filter(message => new Date(message.dateSent) > filtrationThesholdDate);
  }

  getQueryParams() {
    this.activatedRoute.queryParams.subscribe(params => {
      this.queryParams = params;
    });
  }
}
