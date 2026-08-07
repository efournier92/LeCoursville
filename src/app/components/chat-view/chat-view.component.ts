import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MessageViewComponent } from 'src/app/components/message-view/message-view.component';
import { MessageConstants } from 'src/app/constants/message-constants';

@Component({
    selector: 'app-chat-view',
    templateUrl: './chat-view.component.html',
    styleUrls: ['./chat-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ChatViewComponent extends MessageViewComponent {
  messageType: string = MessageConstants.Types.Chat;
}
