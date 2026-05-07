import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpressionEditComponent } from './expression-edit.component';

describe('ExpressionEditComponent', () => {
  let component: ExpressionEditComponent;
  let fixture: ComponentFixture<ExpressionEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExpressionEditComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
