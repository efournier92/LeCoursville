import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Message, Like } from 'src/app/components/chat/message';
import { AuthService } from '../../auth/auth.service';
import { MatDialog } from '@angular/material';
import { NamePrompt } from 'src/app/components/auth/name-prompt/name-prompt';
import { User } from '../../auth/user';

export class Highlights {
  like: boolean = false;
  reply: boolean = false;
  edit: boolean = false;
  cancel: boolean = false;
  send: boolean = false;
}

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.component.html',
  styleUrls: ['./chat-view.component.scss']
})
export class ChatViewComponent implements OnInit {
  user: User;
  highlights: Highlights = new Highlights();
  @Input() message: Message;
  @Input() parent: Message;
  @Output() updateParentEvent = new EventEmitter();
  
  constructor(
    public auth: AuthService,
    public namePrompt: MatDialog,
  ) { }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  likeMessage() {
    if (!this.message.likes)
      this.message.likes = new Array<Like>();
    this.message.likes.push(new Like(this.user));
    this.updateParent();
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
    this.updateParentEvent.emit(this.parent);
  }

  isMessageAuthor(message: Message): boolean {
    if (message.authorId === this.user.id) {
      return true;
    } else {
      return false;
    }
  }
  mouseEnter(element) {
    console.log('hit', element);
  }

  highlightElement(element: string, value: boolean) {
    if (!this.highlights || this.highlights[element] === undefined)
      return;
    this.highlights[element] = value;
  }
  getLikes(message) {
    if (!message.likes)
      return '';
    return message.likes.length;
  }
}
