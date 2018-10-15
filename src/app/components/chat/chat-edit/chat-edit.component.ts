import { Component, OnInit, Input, ViewChild, NgZone, Output, EventEmitter } from '@angular/core';
import { Message } from 'src/app/components/chat/message';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { take } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from 'src/app/components/chat/chat.service';
import { User } from 'src/app/components/auth/user';

@Component({
  selector: 'app-chat-edit',
  templateUrl: './chat-edit.component.html',
  styleUrls: ['./chat-edit.component.scss']
})
export class ChatEditComponent implements OnInit {
  user: User;
  @Input() message: Message;
  @Input() parent: Message;
  @Output() updateParentEvent = new EventEmitter();
  @ViewChild('autosize') autosize: CdkTextareaAutosize;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
  ) { }

  ngOnInit() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    )
  }

  saveMessage(message: Message) {
    message.editable = false;
    if (message.isReply) {
      if (this.parent)
        this.updateParent();
    } else if (!message.id) {
      this.chatService.addMessage(message);
    } else {
      this.chatService.updateMessage(message);
    }
  }

  isMessageAuthor(message: Message): boolean {
    if (message.authorId === this.user.id) {
      return true;
    } else {
      return false;
    }
  }

  updateParent() {
    this.updateParentEvent.emit(this.parent);
  }
  mouseEnter(element) {
    console.log('hit', element);
  }
}
