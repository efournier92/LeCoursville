import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { CalendarCellComponent } from './calendar-cell.component';

describe('CalendarCellComponent', () => {
  let component: CalendarCellComponent;
  let fixture: ComponentFixture<CalendarCellComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [CalendarCellComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarCellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
