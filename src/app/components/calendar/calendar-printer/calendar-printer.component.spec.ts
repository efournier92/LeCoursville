import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarPrinterComponent } from './calendar-printer.component';

describe('CalendarPrinterComponent', () => {
  let component: CalendarPrinterComponent;
  let fixture: ComponentFixture<CalendarPrinterComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CalendarPrinterComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarPrinterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
