import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageComponent } from './message.component';

class StubMessageComponent extends MessageComponent {
  ngOnInit(): void {}
}

describe('MessageComponent', () => {
  let component: StubMessageComponent;
  let fixture: ComponentFixture<StubMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StubMessageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StubMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
