import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi } from 'vitest';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ChatComponent } from './chat.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, LvLoadErrorComponent],
      declarations: [ChatComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calls onCreate from the New Message button', () => {
    const onCreate = vi.spyOn(component, 'onCreate').mockImplementation(() => {});
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(candidate => candidate.textContent?.includes('New Message'));

    expect(button).toBeDefined();
    button.click();

    expect(onCreate).toHaveBeenCalled();
  });

  it('renders the empty state when there are no messages', () => {
    component.loading = false;
    component.allItems = [];
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.chat-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('No messages yet');
  });

  it('renders a retryable load error', () => {
    component.loading = false;
    component.error = true;
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('app-load-error');
    expect(error).not.toBeNull();

    const retry = vi.spyOn(component, 'retry');
    error.querySelector('button').click();

    expect(retry).toHaveBeenCalled();
  });
});
