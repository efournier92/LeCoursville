import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { CalendarPrinterComponent } from './calendar-printer.component';
import { RtdbService } from 'src/app/services/rtdb.service';

describe('CalendarPrinterComponent', () => {
  let component: CalendarPrinterComponent;
  let fixture: ComponentFixture<CalendarPrinterComponent>;

  beforeEach(() => {
    const rtdbSpy = jasmine.createSpyObj('RtdbService', ['list', 'object']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of([]) });
    rtdbSpy.object.and.returnValue({ valueChanges: () => of(null) });

    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [CalendarPrinterComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: RtdbService, useValue: rtdbSpy },
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarPrinterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads available years from configured calendars', () => {
    const rtdbSpy = TestBed.inject(RtdbService) as jasmine.SpyObj<RtdbService>;
    const thisYear = new Date().getFullYear();
    rtdbSpy.list.and.returnValue({
      valueChanges: () => of([{ year: String(thisYear + 1) }])
    });
    component['loadAvailableYears']();
    expect(component.availableYears).toEqual([thisYear + 1]);
  });
});
