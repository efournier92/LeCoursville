import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpressionViewComponent } from './expression-view.component';

describe('ExpressionViewComponent', () => {
  let component: ExpressionViewComponent;
  let fixture: ComponentFixture<ExpressionViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ExpressionViewComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
