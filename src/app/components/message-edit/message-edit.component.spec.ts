import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageEditComponent } from './message-edit.component';

@Component({ template: '' })
class StubMessageEditComponent extends MessageEditComponent {
  override ngOnInit(): void {}
}

describe('MessageEditComponent', () => {
  let component: StubMessageEditComponent;
  let fixture: ComponentFixture<StubMessageEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ StubMessageEditComponent ]
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
