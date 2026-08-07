import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ChatEditComponent } from './chat-edit.component';

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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
