import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageEditComponent } from './message-edit.component';

class StubMessageEditComponent extends MessageEditComponent {
  ngOnInit(): void {}
}

describe('MessageEditComponent', () => {
  let component: StubMessageEditComponent;
  let fixture: ComponentFixture<StubMessageEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StubMessageEditComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StubMessageEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
