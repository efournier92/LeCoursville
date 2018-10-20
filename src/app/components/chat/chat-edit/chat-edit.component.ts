import { Component, OnInit, Input, ViewChild, NgZone, Output, EventEmitter } from '@angular/core';
import { Message } from 'src/app/components/chat/message';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { take } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from 'src/app/components/chat/chat.service';
import { User } from 'src/app/components/auth/user';
import { HighlightService } from '../highlight.service';
import { Router } from '@angular/router';
import { Highlight } from '../highlight';

@Component({
  selector: 'app-chat-edit',
  templateUrl: './chat-edit.component.html',
  styleUrls: ['./chat-edit.component.scss']
})
export class ChatEditComponent implements OnInit {
  user: User;
  highlights: Highlight = new Highlight();
  @Input() message: Message;
  @Input() parent: Message;
  @Output() updateParentEvent = new EventEmitter();
  @Output() deleteEditEvent = new EventEmitter();
  @ViewChild('autosize') autosize: CdkTextareaAutosize;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private highlightService: HighlightService,
    private router: Router,
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

  cancelEdit() {
    if (!this.message.isReply) {
      this.deleteEditEvent.emit(this.parent);
    } else {
      this.parent.replies.shift();
    }
  }

  updateParent() {
    this.updateParentEvent.emit(this.parent);
  }

  deleteEdit() {
  }

  cancelMessage() {
    this.router.navigateByUrl('/chat', {skipLocationChange: true});
  }

  highlightElement(element: string, value: boolean) {
    this.highlights = this.highlightService.highlightElement(this.highlights, element, value);
  }
}
