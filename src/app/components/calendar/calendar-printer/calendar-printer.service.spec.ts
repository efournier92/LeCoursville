import { TestBed, inject } from '@angular/core/testing';

import { CalendarPrinterService } from './calendar-printer.service';

describe('CalendarPrinterService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CalendarPrinterService]
    });
  });

  it('should be created', inject([CalendarPrinterService], (service: CalendarPrinterService) => {
    expect(service).toBeTruthy();
  }));
});
