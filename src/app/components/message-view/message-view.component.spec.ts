import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageViewComponent } from './message-view.component';

class StubMessageViewComponent extends MessageViewComponent {}

describe('MessageViewComponent', () => {
  let component: StubMessageViewComponent;
  let fixture: ComponentFixture<StubMessageViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StubMessageViewComponent ],
      imports: [],
      providers: []
    })
    .compileComponents();

    fixture = TestBed.createComponent(StubMessageViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
