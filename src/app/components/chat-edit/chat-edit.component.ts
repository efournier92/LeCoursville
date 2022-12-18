import { Component, OnInit, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Message } from 'src/app/models/message';
import { AuthService } from 'src/app/services/auth.service';
import { ChatService } from 'src/app/services/chat.service';
import { User } from 'src/app/models/user';
import { HighlightService } from 'src/app/services/highlight.service';
import { Highlight } from 'src/app/models/highlight';
import { PhotosService } from 'src/app/services/photos.service';
import { ConfirmPromptService } from 'src/app/services/confirm-prompt.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-chat-edit',
  templateUrl: './chat-edit.component.html',
  styleUrls: ['./chat-edit.component.scss']
})
export class ChatEditComponent implements OnInit {
  @Input() message: Message;
  @Input() parent: Message;

  @Output() updateParentEvent: EventEmitter<object> = new EventEmitter();
  @Output() cancelEditEvent: EventEmitter<object> = new EventEmitter();

  @ViewChild('autosize')
  user: User;
  highlights: Highlight = new Highlight();
  autosize: CdkTextareaAutosize;
  photoUpload: any;
  isSaving = false;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private photoService: PhotosService,
    private highlightService: HighlightService,
    private db: AngularFireDatabase,
    private confirmPrompt: ConfirmPromptService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  // TODO: Abstract large methods to smaller service methods

  saveMessage(newMessage: Message): void {
    const dialogRef = this.confirmPrompt.openDialog(
      'Are You Sure?',
      'Do you want to post this message to LeCoursville?',
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          if (this.photoUpload && !this.message.isReply) {
            this.saveMessageWithPhoto(newMessage);
            return;
          }
          newMessage = this.markMessageSaved(newMessage);
          newMessage.id = newMessage.id || this.db.createPushId();
          if (newMessage.isReply) {
            if (this.parent) {
              this.updateParent();
            }
          } else if (!newMessage.id) {
            this.chatService.createMessage(newMessage);
          } else {
            this.chatService.updateMessage(newMessage);
          }
        }
      }
    );

    this.analyticsService.logEvent('chat_edit_message_save', {
      id: newMessage?.id, title: newMessage?.title,
      isReply: newMessage?.isReply, parent: this.parent,
      userId: this.user?.id,
    });
  }

  cancelEdit(): void {
    if (!this.message.isReply) {
      this.cancelEditEvent.emit(this.parent);
    } else {
      if (!this.message.isSaved) {
        this.parent.replies.shift();
      } else {
        this.message.isEditable = false;
      }
    }

    this.analyticsService.logEvent('chat_edit_message_edit_cancel', {
      id: this.message?.id,
      title: this.message?.title, parent: this.parent,
      userId: this.user?.id,
    });
  }

  deleteMessage(): void {
    const dialogRef = this.confirmPrompt.openDialog(
      'Are You Sure?',
      'Do you want to remove this message from LeCoursville?',
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          if (this.message.replies && this.message.replies.length !== 0) {
            this.message.isDeleted = true;
          } else if (this.message.isReply) {
            let i = 0;
            for (const reply of this.parent.replies) {
              if (reply.id === this.message.id) {
                this.parent.replies.splice(i, 1);
                this.updateParent();
              }
              i += 1;
            }
          } else {
            this.chatService.deleteMessage(this.message);
          }
          this.message.isEditable = false;
        }
      }
    );

    this.analyticsService.logEvent('chat_edit_message_delete', {
      id: this.message?.id,
      title: this.message?.title, parent: this.parent,
      userId: this.user?.id,
    });
  }

  restoreMessage(): void {
    const dialogRef = this.confirmPrompt.openDialog(
      'Are You Sure?',
      'Do you want to restore this message to LeCoursville?',
    );

    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          this.message.isDeleted = false;
          this.message.isEditable = false;
        }
      }
    );

    this.analyticsService.logEvent('chat_edit_message_restore', {
      id: this.message?.id, title: this.message?.title,
      parent: this.parent, userId: this.user?.id,
    });
  }

  highlightElement(element: string, value: boolean): void {
    this.highlights = this.highlightService.highlightElement(this.highlights, element, value);
  }

  inputFileChangeEvent(files: any): void {
    this.photoUpload = files[0];
  }

  updateParent(): void {
    this.updateParentEvent.emit(this.parent);
  }

  shouldShowStickyButton(): boolean {
    return !!this.user?.roles?.super;
  }

  // HELPER METHODS

  private markMessageSaved(message: Message): Message {
    message.isSaved = true;
    message.isEditable = false;
    return message;
  }

  private saveMessageWithPhoto(message: Message): void {
    this.isSaving = true;
    const photoUpload = this.photoService.uploadPhoto(this.photoUpload, true);
    const uploadFileType = this.photoUpload.type;
    photoUpload.onUrlAvailable.subscribe(
      (url: string) => {
        if (url === '') { return; }
        message.attachmentUrl = url;
        message.attachmentType = uploadFileType;
        message = this.markMessageSaved(message);
        this.chatService.createMessage(message);
        this.isSaving = false;
      }
    );
  }
}
