import { TestBed } from '@angular/core/testing';

import { ContactsPrinterService } from './contacts-printer.service';

describe('ContactsPrinterService', () => {
  let service: ContactsPrinterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContactsPrinterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
