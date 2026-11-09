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

  it('shows an attribution author once and the year once', () => {
    Object.assign(component.message, { attribution: 'Patrick Henry', authorName: 'Patrick Henry', yearWritten: '1775' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect((text.match(/Patrick Henry/g) ?? []).length).toBe(1);
    expect((text.match(/1775/g) ?? []).length).toBe(1);
  });

  it('keeps a distinct author and attribution visible', () => {
    Object.assign(component.message, { attribution: 'E2E Family', authorName: 'Admin User', yearWritten: '2000' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('E2E Family');
    expect(text).toContain('Admin User');
    expect(text).toContain('2000');
  });
});
