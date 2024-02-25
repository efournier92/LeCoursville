import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Message } from 'src/app/models/message';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  messages: AngularFireList<Message>;
  messagesObservable: Observable<Message[]>;

  private messagesSource: BehaviorSubject<Message[]>;

  constructor(
    private db: AngularFireDatabase,
    private auth: AuthService,
  ) {
    this.messagesSource = new BehaviorSubject([]);
    this.messagesObservable = this.messagesSource.asObservable();
    this.subscribeToUserObservable();
  }

  // PUBLIC

  create(message: Message): void {
    message.id = this.db.createPushId();
    this.messages.update(message.id, message);
  }

  updateMessage(message: Message): void {
    this.messages.update(message.id, message);
  }

  deleteMessage(message: Message): void {
    this.messages.remove(message.id);
  }

  filterByType(messages: Message[], type: string): any[] {
    return messages.filter(message => message.messageType === type);
  }

  // HELPERS

  private getMessages(): AngularFireList<Message> {
    this.messages = this.db.list('messages');
    return this.messages;
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
