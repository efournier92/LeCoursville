import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { Message } from 'src/app/models/message';
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
    message.id = this.rtdb.createPushId();
    this.rtdb.object(`messages/${message.id}`).update(message as any);
  }

  updateMessage(message: Message): void {
    this.rtdb.object(`messages/${message.id}`).update(message as any);
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
    this.messagesSource.next(messages);
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
