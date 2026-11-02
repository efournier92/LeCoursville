import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ChatViewComponent } from './chat-view.component';
import { Message } from 'src/app/models/message';

function makeMessage(): Message {
  return new Message('Hello', 'Body', '', 'user-1', 'Alice', false, false, 0);
}

describe('ChatViewComponent', () => {
  let component: ChatViewComponent;
  let fixture: ComponentFixture<ChatViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatMenuModule],
      declarations: [ChatViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatViewComponent);
    component = fixture.componentInstance;
    component.message = makeMessage();
    component.parent = makeMessage();
    fixture.detectChanges();
  });

  it('should create and render a chat message', () => {
    expect(component).toBeTruthy();
    expect(component.messageType).toBe('chat');
    expect(component.message.title).toBe('Hello');
  });

  it('getAttachmentType classifies image attachments as photo', () => {
    component.message.attachmentUrl = 'https://example.com/photo.jpg';
    component.message.attachmentType = 'image/jpeg';
    expect(component.getAttachmentType(component.message)).toBe('photo');
  });

  it('getAttachmentType returns undefined when there is no attachment', () => {
    component.message.attachmentUrl = '';
    expect(component.getAttachmentType(component.message)).toBeUndefined();
  });

  it('shows the Edit control for the author and for admins on foreign messages', () => {
    const editControl = () =>
      Array.from(fixture.nativeElement.querySelectorAll('.message-button'))
        .find((el: Element) => el.textContent?.includes('Edit'));

    component.user = { id: 'user-1', roles: { user: true } } as any;
    fixture.detectChanges();
    expect(editControl()).toBeTruthy();

    // A member on another author's message cannot edit it.
    component.user = { id: 'someone-else', roles: { user: true } } as any;
    fixture.detectChanges();
    expect(editControl()).toBeUndefined();

    // An admin moderates a foreign message.
    component.user = { id: 'someone-else', roles: { admin: true } } as any;
    fixture.detectChanges();
    expect(editControl()).toBeTruthy();
  });
});
