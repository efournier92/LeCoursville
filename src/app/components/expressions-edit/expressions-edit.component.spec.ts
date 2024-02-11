import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpressionsEditComponent } from './expressions-edit.component';

describe('ExpressionsEditComponent', () => {
  let component: ExpressionsEditComponent;
  let fixture: ComponentFixture<ExpressionsEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExpressionsEditComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionsEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
