import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { Message, Like } from 'src/app/models/message';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  messagesObservable: Observable<Message[]>;
  // minimalist: error side-channel instead of erroring the BehaviorSubject,
  // which would terminate every subscriber permanently; retry re-subscribes.
  messagesError$: Observable<void>;

  private messagesSource: BehaviorSubject<Message[]>;
  private messagesErrorSource = new Subject<void>();
  private messagesSub: Subscription | null = null;

  constructor(
    private rtdb: RtdbService,
    private auth: AuthService,
  ) {
    this.messagesSource = new BehaviorSubject([]);
    this.messagesObservable = this.messagesSource.asObservable();
    this.messagesError$ = this.messagesErrorSource.asObservable();
    this.subscribeToUserObservable();
  }

  // PUBLIC

  create(message: Message): void {
    message.id = message.id || this.rtdb.createPushId();
    this.rtdb.object(`messages/${message.id}`).set(this.createPayload(message));
  }

  updateMessage(message: Message): void {
    this.rtdb.object(`messages/${message.id}`).update(this.updatePayload(message));
  }

  /** Replying is a write to the message's replies child, never a parent rewrite. */
  saveReply(rootId: string, reply: Message, isNew: boolean): void {
    const path = `messages/${rootId}/replies/${reply.id}`;
    if (isNew) {
      this.rtdb.object(path).set(this.createReplyPayload(reply));
    } else {
      this.rtdb.object(path).update(this.updateReplyPayload(reply));
    }
  }

  deleteReply(rootId: string, replyId: string): void {
    this.rtdb.object(`messages/${rootId}/replies/${replyId}`).remove();
  }

  /** A like is keyed by its author, so one member cannot forge another. */
  addLike(messagePath: string, like: Like): void {
    this.rtdb.object(`${messagePath}/likes/${like.userId}`).set({
      userId: like.userId,
      userName: like.userName,
    });
  }

  deleteMessage(message: Message): void {
    this.rtdb.object(`messages/${message.id}`).remove();
  }

  filterByType(messages: Message[], type: string): any[] {
    return messages.filter(message => message.messageType === type);
  }

  // HELPERS

  private getMessages() {
    return this.rtdb.list<Message>('messages');
  }

  private updateMessagesEvent(messages: Message[]): void {
    this.messagesSource.next(messages.map(message => this.normalizeMessage(message)));
  }

  private createPayload(message: Message): Record<string, unknown> {
    return {
      id: message.id,
      authorId: message.authorId,
      authorName: message.authorName,
      ...this.contentPayload(message),
      dateSent: new Date(message.dateSent).getTime(),
      isReply: false,
      replyLevel: 0,
      messageType: message.messageType,
    };
  }

  private updatePayload(message: Message): Record<string, unknown> {
    // authorId is carried so the rule re-checks ownership on every update;
    // id, authorName, dateSent, messageType, and the reply/like trees are
    // deliberately absent.
    return {
      authorId: message.authorId,
      ...this.contentPayload(message),
    };
  }

  private createReplyPayload(reply: Message): Record<string, unknown> {
    return {
      id: reply.id,
      authorId: reply.authorId,
      authorName: reply.authorName,
      ...this.contentPayload(reply),
      dateSent: new Date(reply.dateSent).getTime(),
      isReply: true,
      replyLevel: reply.replyLevel,
      isSticky: false,
      messageType: reply.messageType,
    };
  }

  private updateReplyPayload(reply: Message): Record<string, unknown> {
    return {
      authorId: reply.authorId,
      ...this.contentPayload(reply),
    };
  }

  private contentPayload(message: Message): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      title: message.title ?? '',
      body: message.body ?? '',
      attachmentId: message.attachmentId ?? '',
      attachmentType: message.attachmentType ?? '',
      attachmentUrl: message.attachmentUrl ?? '',
      isDeleted: !!message.isDeleted,
      isSaved: !!message.isSaved,
      isEditable: false,
      isSticky: !!message.isSticky,
    };
    if (message.messageType === 'expression') {
      const expression = message as Message & {
        attribution?: string;
        yearWritten?: string;
      };
      payload.attribution = expression.attribution ?? '';
      payload.yearWritten = expression.yearWritten ?? '';
    }
    return payload;
  }

  private normalizeMessage(message: Message): Message {
    if (!message) {
      return message;
    }
    message.likes = this.toArray<Like>(message.likes).map(like => ({ ...like }));
    message.replies = this.toArray<Message>(message.replies)
      .map(reply => this.normalizeMessage(reply));
    return message;
  }

  private toArray<T>(value: T[] | Record<string, T> | null | undefined): T[] {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : Object.values(value);
  }

  private subscribeToUserObservable() {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user) {
          this.subscribeToGetMessages();
        }
      },
      () => this.messagesErrorSource.next(),
    );
  }

  retryMessages(): void {
    this.subscribeToGetMessages();
  }

  private subscribeToGetMessages(): void {
    this.messagesSub?.unsubscribe();
    this.messagesSub = this.getMessages().valueChanges().subscribe(
      (messages: Message[]) => {
        this.updateMessagesEvent(messages);
      },
      () => this.messagesErrorSource.next(),
    );
  }
}
