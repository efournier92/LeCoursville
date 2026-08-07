import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatInputModule } from '@angular/material/input';

import { ExpressionEditComponent } from './expression-edit.component';

describe('ExpressionEditComponent', () => {
  let component: ExpressionEditComponent;
  let fixture: ComponentFixture<ExpressionEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ MatInputModule ],
      declarations: [ ExpressionEditComponent ],
      schemas: [NO_ERRORS_SCHEMA],
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
