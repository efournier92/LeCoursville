import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MessageEditComponent } from 'src/app/components/message-edit/message-edit.component';
import { MessageConstants } from 'src/app/constants/message-constants';

@Component({
    selector: 'app-chat-edit',
    templateUrl: './chat-edit.component.html',
    styleUrls: ['./chat-edit.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ChatEditComponent extends MessageEditComponent {
  messageType: string = MessageConstants.Types.Chat;
}

