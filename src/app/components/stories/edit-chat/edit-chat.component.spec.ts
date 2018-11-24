import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditChatComponent } from './edit-chat.component';

describe('ChatEditComponent', () => {
  let component: EditChatComponent;
  let fixture: ComponentFixture<EditChatComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [EditChatComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
