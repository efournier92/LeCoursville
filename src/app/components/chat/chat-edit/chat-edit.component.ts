import { Component, OnInit, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { Message } from 'src/app/components/chat/message';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from 'src/app/components/chat/chat.service';
import { User } from 'src/app/components/auth/user';
import { HighlightService } from '../highlight.service';
import { Router } from '@angular/router';
import { Highlight } from '../highlight';
import { PhotosService } from '../../photos/photos.service';
import { AngularFireDatabase } from '@angular/fire/database';
import { ConfirmPromptService } from '../../confirm-prompt/confirm-prompt.service';

declare interface HtmlInput extends HTMLElement {
  value: string;
}

@Component({
  selector: 'app-chat-edit',
  templateUrl: './chat-edit.component.html',
  styleUrls: ['./chat-edit.component.scss']
})
export class ChatEditComponent implements OnInit {
  user: User;
  highlights: Highlight = new Highlight();
  @Input()
  message: Message;
  @Input()
  parent: Message;
  @Output()
  updateParentEvent: EventEmitter<Object> = new EventEmitter();
  @Output()
  cancelEditEvent: EventEmitter<Object> = new EventEmitter();
  @ViewChild('autosize')
  autosize: CdkTextareaAutosize;
  photoUpload: any;
  isSaving: boolean = false;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private photoService: PhotosService,
    private highlightService: HighlightService,
    private router: Router,
    private db: AngularFireDatabase,
    private confirmPrompt: ConfirmPromptService,
  ) { }

  ngOnInit(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    )
  }

  markMessageSaved(message: Message): Message {
    message.isSaved = true;
    message.isEditable = false;
    return message;
  }

  saveMessage(message: Message): void {
    const dialogRef = this.confirmPrompt.openDialog(
      "Are You Sure?",
      "Do you want to post this message to LeCoursville?",
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          if (this.photoUpload && !this.message.isReply) {
            this.saveMessageWithPhoto(message);
            return;
          }
          message = this.markMessageSaved(message);
          message.id = this.db.createPushId();
          if (message.isReply) {
            if (this.parent)
              this.updateParent();
          } else if (!message.id) {
            this.chatService.createMessage(message);
          } else {
            this.chatService.updateMessage(message);
          }
        }
      }
    )
  }

  saveMessageWithPhoto(message: Message): void {
    this.isSaving = true;
    const photoUpload = this.photoService.uploadPhoto(this.photoUpload, true);
    photoUpload.onUrlAvailable.subscribe(
      (url: string) => {
        if (url === '') return;
        message.photoUrl = url;
        message = this.markMessageSaved(message);
        this.chatService.createMessage(message);
        this.isSaving = false;
      }
    )
  }

  isMessageAuthor(message: Message): boolean {
    if (message.authorId === this.user.id) {
      return true;
    } else {
      return false;
    }
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
  }

  deleteMessage(): void {
    const dialogRef = this.confirmPrompt.openDialog(
      "Are You Sure?",
      "Do you want to remove this message from LeCoursville?",
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
    )
  }

  restoreMessage(): void {
    const dialogRef = this.confirmPrompt.openDialog(
      "Are You Sure?",
      "Do you want to restore this message to LeCoursville?",
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          this.message.isDeleted = false;
          this.message.isEditable = false;
        }
      }
    )
  }

  updateParent(): void {
    this.updateParentEvent.emit(this.parent);
  }

  cancelMessage(): void {
    this.router.navigateByUrl('/chat', { skipLocationChange: true });
  }

  highlightElement(element: string, value: boolean): void {
    this.highlights = this.highlightService.highlightElement(this.highlights, element, value);
  }

  onInputFileChange(files: any): void {
    this.photoUpload = files[0];
  }
}
