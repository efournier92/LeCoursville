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

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private photoService: PhotosService,
    private highlightService: HighlightService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    )
  }

  saveMessage(message: Message): void {
    message.isEditable = false;
    message.isSaved = true;
    if (this.photoUpload && !this.message.isReply) {
      this.saveMessageWithPhoto(message);
      return;
    }
    if (message.isReply) {
      if (this.parent)
        this.updateParent();
    } else if (!message.id) {
      this.chatService.createMessage(message);
    } else {
      this.chatService.updateMessage(message);
    }
  }

  saveMessageWithPhoto(message: Message): void {
    let photoUpload = this.photoService.uploadPhoto(this.photoUpload);
    photoUpload.onUrlAvailable.subscribe(
      (url: string) => {
        message.photoUrl = url;
        this.chatService.createMessage(message);
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

  restoreMessage(): void {
    this.message.isDeleted = false;
    this.message.isEditable = false;
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

  updatePhotoUpload(event: any) {
    this.photoUpload = event.currentTarget.files[0];
    console.log(this.photoUpload);
  }

  onCancelUpload() {
    let uploadInputElement = document.getElementById('uploadPhotoInput') as HtmlInput;
    uploadInputElement.value = '';
    this.photoUpload = undefined;
  }
}
