import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ExpressionViewComponent } from './expression-view.component';
import { Message } from 'src/app/models/message';

function makeMessage(): Message {
  return new Message('Hello', 'Body', '', 'user-1', 'Alice', false, false, 0);
}

describe('ExpressionViewComponent', () => {
  let component: ExpressionViewComponent;
  let fixture: ComponentFixture<ExpressionViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ExpressionViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionViewComponent);
    component = fixture.componentInstance;
    component.message = makeMessage();
    component.parent = makeMessage();
    fixture.detectChanges();
  });

  it('should create and render an expression', () => {
    expect(component).toBeTruthy();
    expect(component.message.title).toBe('Hello');
  });

  it('getLikes returns 0 for a message with no likes', () => {
    expect(component.getLikes()).toBe(0);
  });
});
