import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';
import { Message } from './message';
import { AuthService } from 'src/app/components/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  messages: AngularFireList<Message>;
  messageCount: number = 0;
  increment: number = 2;

  constructor(
    private storage: AngularFireStorage,
    private db: AngularFireDatabase,
  ) {
    // this.auth.authState.subscribe(user => {
    // if (user) this.userId = user.uid;
    this.getMessages().valueChanges().subscribe(
      (messages: Message[]) => {
        this.updateMessagesEvent(messages);
      }
    );
    // });
  }

  getYears() {
    let years = Array<Number>();
    for (let i = 1880; i <= 2000; i++) {
      years.push(i);
    }
    return years;
  }

  private messagesSource = new BehaviorSubject([]);
  chatObservable = this.messagesSource.asObservable();

  updateMessagesEvent(messages: Message[]) {
    this.messagesSource.next(messages);
  }

  getMessages() {
    this.messageCount = this.messageCount + this.increment;
    this.messages = this.db.list('messages', ref => ref.limitToFirst(this.messageCount));
    return this.messages;
  }

  addMessage(title, body, authorId, authorName) {
    let message = new Message(title, body, authorId, authorName);
    message.id = this.db.createPushId();
    this.messages.push(message);
  }

  updateMessage(message: Message) {
    this.messages.update(message.id, message);
  }

  deleteMessage(message: Message) {
    this.messages.remove(message.id);
  }

}
