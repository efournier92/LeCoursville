import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { TestSharedModule } from '../../../../test-shared.module';
import { AppModule } from '../../../app.module';
import { ContactEditComponent } from './contact-edit.component';
import { Contact } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ContactsService } from 'src/app/services/contacts.service';

function makeContact(): Contact {
  const contact = new Contact();
  contact.id = 'contact-1';
  contact.name = 'Jane Smith';
  return contact;
}

describe('ContactEditComponent', () => {
  let component: ContactEditComponent;
  let fixture: ComponentFixture<ContactEditComponent>;
  let confirmDialog: { confirm: ReturnType<typeof vi.fn> };
  let contactsService: { deleteContact: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    confirmDialog = { confirm: vi.fn(() => Promise.resolve(false)) };
    contactsService = { deleteContact: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ContactEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuthService, useValue: { userObservable: of({ roles: { admin: false } }) } },
        { provide: ConfirmDialogService, useValue: confirmDialog },
        { provide: ContactsService, useValue: contactsService },
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactEditComponent);
    component = fixture.componentInstance;
    component.contact = makeContact();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the contact editor sections', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Addresses');
    expect(text).toContain('Phones');
    expect(text).toContain('Emails');
  });

  it('addEmail appends an empty email and logs analytics', () => {
    const contact = makeContact();
    component.addEmail(contact);
    expect(contact.emails.length).toBe(1);
    expect(contact.emails[0].address).toBe('');
  });

  it('confirms before deleting a contact', async () => {
    const contact = makeContact();

    await component.deleteContact(contact);

    expect(confirmDialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ destructive: true }),
    );
    expect(contactsService.deleteContact).not.toHaveBeenCalled();

    confirmDialog.confirm.mockResolvedValue(true);
    await component.deleteContact(contact);

    expect(contactsService.deleteContact).toHaveBeenCalledWith(contact);
  });
});
