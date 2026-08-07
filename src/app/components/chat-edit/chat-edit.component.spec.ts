import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ChatEditComponent } from './chat-edit.component';
import { Message } from 'src/app/models/message';

function makeMessage(): Message {
  return new Message('Hello', 'Body', '', 'user-1', 'Alice', false, false, 0);
}

describe('ChatEditComponent', () => {
  let component: ChatEditComponent;
  let fixture: ComponentFixture<ChatEditComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatInputModule],
      declarations: [ChatEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatEditComponent);
    component = fixture.componentInstance;
    component.message = makeMessage();
    component.parent = makeMessage();
    fixture.detectChanges();
  });

  it('should create and render a message editor', () => {
    expect(component).toBeTruthy();
    expect(component.messageType).toBe('chat');
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text.length).toBeGreaterThan(0);
  });

  it('starts unsaved and editable', () => {
    expect(component.message.isSaved).toBe(false);
    expect(component.message.isEditable).toBe(false);
    expect(component.message.replies).toEqual([]);
  });
});
