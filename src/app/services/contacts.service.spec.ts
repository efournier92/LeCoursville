import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ContactsService } from './contacts.service';
import { AuthService } from './auth.service';
import { RtdbService } from './rtdb.service';
import { Contact } from 'src/app/models/contact';

describe('ContactsService', () => {
  let service: ContactsService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of([]) });
    rtdbSpy.createPushId.and.returnValue('push-id');
    rtdbSpy.object.and.returnValue({
      valueChanges: () => of(null),
      update: jasmine.createSpy('update'),
      set: jasmine.createSpy('set'),
      remove: jasmine.createSpy('remove'),
    });

    TestBed.configureTestingModule({
      providers: [
        ContactsService,
        { provide: AuthService, useValue: { userObservable: of({ id: 'u1' }) } },
        { provide: RtdbService, useValue: rtdbSpy },
      ]
    });

    service = TestBed.inject(ContactsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('updateContactsEvent broadcasts contact updates', async () => {
    const contacts = [new Contact(), new Contact()];
    service.updateContactsEvent(contacts);
    const emitted = await firstValueFrom(service.userContacts);
    expect(emitted).toEqual(contacts);
  });

  it('newContact assigns a push id and writes the record', () => {
    const contact = new Contact();
    contact.name = 'Jane';
    service.newContact(contact);
    expect(contact.id).toBe('push-id');
    expect(rtdbSpy.object).toHaveBeenCalledWith('contacts/push-id');
    expect(rtdbSpy.object('contacts/push-id').set).toHaveBeenCalledWith(contact);
  });

  it('updateContact assigns an id when missing, then updates the record', () => {
    const contact = new Contact();
    contact.name = 'Jane';
    service.updateContact(contact);
    expect(contact.id).toBe('push-id');
    expect(rtdbSpy.object('contacts/push-id').update).toHaveBeenCalledWith(contact);
  });

  it('deleteContact removes the record', () => {
    const contact = new Contact();
    contact.id = 'contact-1';
    service.deleteContact(contact);
    expect(rtdbSpy.object('contacts/contact-1').remove).toHaveBeenCalled();
  });

  it('getContacts returns undefined when no user is signed in', () => {
    (service as any).user = null;
    expect(service.getContacts()).toBeUndefined();
  });
});
