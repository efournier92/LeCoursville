import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';

import { ExpressionEditComponent } from './expression-edit.component';
import { Message } from 'src/app/models/message';

function makeMessage(): Message {
  return new Message('Hello', 'Body', '', 'user-1', 'Alice', false, false, 0);
}

describe('ExpressionEditComponent', () => {
  let component: ExpressionEditComponent;
  let fixture: ComponentFixture<ExpressionEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatInputModule],
      declarations: [ExpressionEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionEditComponent);
    component = fixture.componentInstance;
    component.message = makeMessage();
    component.parent = makeMessage();
    fixture.detectChanges();
  });

  it('should create and render an expression editor', () => {
    expect(component).toBeTruthy();
    expect(component.messageType).toBe('chat');
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text.length).toBeGreaterThan(0);
  });
});
