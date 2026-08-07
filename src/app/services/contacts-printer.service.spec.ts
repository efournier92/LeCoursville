import { TestBed } from '@angular/core/testing';

import { ContactsPrinterService } from './contacts-printer.service';
import { Contact } from '../models/contact';

function makeContact(overrides: Partial<Contact> = {}): Contact {
  const contact = new Contact();
  contact.name = 'Jane Smith';
  contact.emails = [{ address: 'jane@example.com', info: 'Email' }];
  contact.phones = [{ number: '555-1234', info: 'Phone' }];
  contact.addresses = [{ street: '123 Main St', city: 'Boston', state: 'MA', zip: '02101', info: '' }];
  return { ...contact, ...overrides };
}

function makePdfFake() {
  return {
    setFontSize: jasmine.createSpy('setFontSize'),
    getFontList: jasmine.createSpy('getFontList'),
    setFont: jasmine.createSpy('setFont'),
    text: jasmine.createSpy('text'),
    save: jasmine.createSpy('save'),
    autoPrint: jasmine.createSpy('autoPrint'),
    output: jasmine.createSpy('output').and.returnValue('blob:url'),
    addPage: jasmine.createSpy('addPage'),
  };
}

describe('ContactsPrinterService', () => {
  let service: ContactsPrinterService;
  let pdfFake: ReturnType<typeof makePdfFake>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContactsPrinterService);
    pdfFake = makePdfFake();
    (service as any).pdf = pdfFake;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('downloadPdf renders every contact and saves the directory file', () => {
    const contacts = [makeContact({ name: 'Jane Smith' }), makeContact({ name: 'John Doe' })];

    service.downloadPdf(contacts);

    expect(pdfFake.text).toHaveBeenCalledWith('Jane Smith', expect.anything(), expect.anything());
    expect(pdfFake.text).toHaveBeenCalledWith('John Doe', expect.anything(), expect.anything());
    expect(pdfFake.text).toHaveBeenCalledWith('jane@example.com', expect.anything(), expect.anything());
    expect(pdfFake.text).toHaveBeenCalledWith('555-1234', expect.anything(), expect.anything());
    expect(pdfFake.save).toHaveBeenCalledWith('LeCoursville_Directory.pdf');
  });

  it('printPdf opens a blob window and triggers auto-print', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    service.printPdf([makeContact()]);

    expect(pdfFake.output).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith('blob:url');
    expect(pdfFake.autoPrint).toHaveBeenCalled();
  });

  it('skips contacts without phone numbers or emails', () => {
    const contact = makeContact({ phones: [], emails: [] });
    expect(() => service.downloadPdf([contact])).not.toThrow();
    expect(pdfFake.text).toHaveBeenCalledWith('Jane Smith', expect.anything(), expect.anything());
  });
});
