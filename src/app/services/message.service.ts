import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Message } from 'src/app/models/message';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  messagesObservable: Observable<Message[]>;

  private messagesSource: BehaviorSubject<Message[]>;

  constructor(
    private rtdb: RtdbService,
    private auth: AuthService,
  ) {
    this.messagesSource = new BehaviorSubject([]);
    this.messagesObservable = this.messagesSource.asObservable();
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
      }
    );
  }

  private subscribeToGetMessages(): void {
    this.getMessages().valueChanges().subscribe(
      (messages: Message[]) => {
        this.updateMessagesEvent(messages);
      }
    );
  }
}
