import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { Message, Like } from 'src/app/components/chat/message';
import { AuthService } from '../../auth/auth.service';
import { MatDialog, MatMenuTrigger } from '@angular/material';
import { NamePrompt } from 'src/app/components/auth/name-prompt/name-prompt';
import { User } from '../../auth/user';
import { HighlightService } from '../highlight.service';

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.component.html',
  styleUrls: ['./chat-view.component.scss']
})
export class ChatViewComponent implements OnInit {
  user: User;
  highlights: object[] = new Array<object>();
  likers: string[] = new Array<string>();
  @Input() message: Message;
  @Input() parent: Message;
  @Output() updateParentEvent = new EventEmitter();
  @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;
  
  constructor(
    public auth: AuthService,
    public namePrompt: MatDialog,
    public highlightService: HighlightService,
  ) { }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user
    );
    this.likers = this.getLikers();
    if (!this.message.likes)
      this.message.likes = new Array<Like>();
  }

  likeMessage() {
    if (!this.message.likes)
      this.message.likes = new Array<Like>();
    for (let like of this.message.likes) {
      if (like.userId == this.user.id) {
        this.trigger.openMenu();
        return;
      }
    }
    this.message.likes.push(new Like(this.user));
    this.trigger.openMenu();
    this.trigger.menuClosed.subscribe(
      () => this.updateParent()
    );
    this.likers = this.getLikers();
    console.log(this.likers);
  }

  getLikers() {
    let likers = new Array<string>();
    if (!this.message.likes)
      return likers;
    for (const liker of this.message.likes) {
      likers.push(liker.userName);
    }
    return likers;
  }
  
  replyMessage() {
    if (!this.auth.user.name)
      this.openNamePrompt();
    let authorId = this.auth.user.id;
    let authorName = this.auth.user.name;
    let replyLevel = this.message.replyLevel + 1;
    let isSaved = false;
    if (!this.message.replies)
    this.message.replies = new Array<Message>();
    this.message.replies.unshift(new Message('', '', authorId, authorName, true, true, replyLevel));
  }

  openNamePrompt(): void {
    const namePromptRef = this.namePrompt.open(NamePrompt, {
      data: { name: 'this.name', animal: 'this.animal' }
    });

    namePromptRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
    });
  }

  updateParent(): void {
    this.updateParentEvent.emit(this.message);
  }

  isMessageAuthor(message: Message): boolean {
    if (message.authorId === this.user.id) {
      return true;
    } else {
      return false;
    }
  }

  highlightElement(element: string, value: boolean) {
    this.highlights = this.highlightService.highlightElement(this.highlights, element, value);
  }

  getLikes(): number {
    if (!this.message.likes)
      return 0;
    return this.message.likes.length;
  }

  editMessage(): void {
    this.message.editable = true;
  }
}