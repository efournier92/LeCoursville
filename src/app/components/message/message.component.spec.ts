import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageComponent } from './message.component';

@Component({ template: '' })
class StubMessageComponent extends MessageComponent {
  override ngOnInit(): void {}
}

describe('MessageComponent', () => {
  let component: StubMessageComponent;
  let fixture: ComponentFixture<StubMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ StubMessageComponent ]
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
