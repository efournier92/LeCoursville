import { Component, OnInit, Input } from '@angular/core';
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
    if (!message.replies)
      message.replies = new Array<Message>();
    message.replies.unshift(new Message('', '', authorId, authorName, true, true));
  }

  openNamePrompt(): void {
    const namePromptRef = this.namePrompt.open(NamePrompt, {
      data: { name: 'this.name', animal: 'this.animal' }
    });

    namePromptRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
    });
  }
}
