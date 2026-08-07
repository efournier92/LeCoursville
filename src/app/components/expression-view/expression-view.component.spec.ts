import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ExpressionViewComponent } from './expression-view.component';

describe('ExpressionViewComponent', () => {
  let component: ExpressionViewComponent;
  let fixture: ComponentFixture<ExpressionViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ExpressionViewComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
