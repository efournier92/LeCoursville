import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { AuthService } from 'src/app/services/auth.service';
import { Message, Like } from 'src/app/models/message';
import { User } from 'src/app/models/user';
import { HighlightService } from 'src/app/services/highlight.service';
import { Highlight } from 'src/app/models/highlight';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-chat-view',
  templateUrl: './chat-view.component.html',
  styleUrls: ['./chat-view.component.scss']
})
export class ChatViewComponent implements OnInit {
  @Input() message: Message;
  @Input() parent: Message;

  @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;

  @Output() updateParentEvent = new EventEmitter();

  user: User;
  highlights: Highlight = new Highlight();
  likers: string[] = new Array<string>();

  constructor(
    public authService: AuthService,
    public highlightService: HighlightService,
    public analyticsService: AnalyticsService,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.initializeMessageData();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  likeMessage(): void {
    if (!this.message.likes) {
      this.message.likes = new Array<Like>();
    }
    for (const like of this.message.likes) {
      if (like.userId === this.user.id) {
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

    this.analyticsService.logEvent('chat_view_message_like', {
      user: this.user, message: this.message, parentMessage: this.parent, likers: this.likers
    });
  }

  replyMessage(): void {
    const authorId: string = this.user.id;
    const authorName: string = this.user.name;
    const replyLevel: number = this.message.replyLevel + 1;
    if (!this.message.replies) {
      this.message.replies = new Array<Message>();
    }
    this.message.replies.unshift(new Message('', '', '', authorId, authorName, true, true, replyLevel));

    this.analyticsService.logEvent('chat_view_message_reply', {
      user: this.user, message: this.message, parentMessage: this.parent,
    });
  }

  highlightElement(element: string, value: boolean) {
    this.highlights = this.highlightService.highlightElement(this.highlights, element, value);
  }

  editMessage(): void {
    this.message.isEditable = true;
  }

  getAttachmentType(message: Message): string {
    if (!message || !message.attachmentUrl || message.attachmentUrl === '') {
      return undefined;
    }
    if (message.attachmentType.includes('image')) {
      return 'photo';
    } else if (message.attachmentType.includes('pdf') || message.attachmentType.includes('text')) {
      return 'document';
    } else {
      return 'other';
    }
  }

  getLikes(): number {
    if (!this.message.likes) {
      return 0;
    }
    return this.message.likes.length;
  }

  updateParent(): void {
    this.updateParentEvent.emit(this.message);
  }

  // HELPER METHODS

  private initializeMessageData() {
    this.likers = this.getLikers();

    if (!this.message.likes) {
      this.message.likes = new Array<Like>();
    }

    if (this.message.replies) {
      this.sortReplies();
    }
  }

  private compareReplies(a: Message, b: Message): any {
    if (!a.likes) {
      a.likes = [];
    }
    if (!b.likes) {
      b.likes = [];
    }
    return b.likes.length - a.likes.length;
  }

  private sortReplies(): void {
    this.message.replies.sort(this.compareReplies);
  }

  private getLikers(): string[] {
    const likers: string[] = new Array<string>();
    if (!this.message.likes) {
      return likers;
    }
    for (const liker of this.message.likes) {
      likers.push(liker.userName);
    }
    return likers;
  }
}
