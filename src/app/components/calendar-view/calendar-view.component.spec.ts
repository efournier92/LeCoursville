import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { CalendarViewComponent } from './calendar-view.component';

describe('CalendarViewComponent', () => {
  let component: CalendarViewComponent;
  let fixture: ComponentFixture<CalendarViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [CalendarViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarViewComponent);
    component = fixture.componentInstance;
    component.viewDate = new Date(2024, 6, 1);
    component.selectedYear = 2024;
    component.events = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('getHiddenEventCount returns 0 for a day with few events', () => {
    const day = {
      date: new Date(2024, 6, 1),
      events: [{ date: new Date(2024, 6, 2) }],
    };
    expect(component.getHiddenEventCount(day)).toBe(0);
  });

  it('getHiddenEventCount caps visible events per cell', () => {
    const day = {
      date: new Date(2024, 6, 1),
      events: [1, 2, 3, 4, 5, 6].map(i => ({ date: new Date(2024, 6, i) })),
    };
    expect(component.getHiddenEventCount(day)).toBe(2);
  });
});
