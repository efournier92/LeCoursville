import { Component, OnInit } from '@angular/core';
import { MessageComponent } from 'src/app/components/message/message.component';
import { Message } from 'src/app/models/message';
import { MessageConstants } from 'src/app/constants/message-constants';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent extends MessageComponent implements OnInit {
  messageType: string = MessageConstants.Types.Chat;

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    super.ngOnInit();
  }

  // PUBLIC METHODS

  create(): void {
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

  onMessagesObservableUpdate(messages: Message[]) {
    messages = this.filterRelevantMessages(messages);
    this.messages = messages.sort(this.compareMessagesByTimestamp);
    this.bumpStickies();
  }
}
