import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Message } from 'src/app/components/chat/message';
import { AuthService } from '../../auth/auth.service';
import { MatDialog } from '@angular/material';
import { NamePrompt } from 'src/app/components/auth/name-prompt/name-prompt';

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.component.html',
  styleUrls: ['./chat-view.component.scss']
})
export class ChatViewComponent implements OnInit {
  @Input() message: Message;
  @Input() parent: Message;
  @Output() updateParentEvent = new EventEmitter();
  
  constructor(
    public auth: AuthService,
    public namePrompt: MatDialog,
  ) { }

  ngOnInit() {
  }

  replyMessage(message: Message) {
    if (!this.auth.user.name) {
      this.openNamePrompt();
    }
    let authorId = this.auth.user.id;
    let authorName = this.auth.user.name;
    let replyLevel = this.parent.replyLevel + 1;
    if (!message.replies)
      message.replies = new Array<Message>();
    message.replies.unshift(new Message('', '', authorId, authorName, true, true, replyLevel));
  }

  openNamePrompt(): void {
    const namePromptRef = this.namePrompt.open(NamePrompt, {
      data: { name: 'this.name', animal: 'this.animal' }
    });

    namePromptRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
    });
  }
  updateParent() {
    console.log(this.message);
    this.updateParentEvent.emit(this.parent);
  }
}
