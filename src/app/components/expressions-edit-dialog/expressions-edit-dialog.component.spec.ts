import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpressionsEditDialogComponent } from './expressions-edit-dialog.component';

describe('ExpressionsEditDialogComponent', () => {
  let component: ExpressionsEditDialogComponent;
  let fixture: ComponentFixture<ExpressionsEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExpressionsEditDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionsEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
