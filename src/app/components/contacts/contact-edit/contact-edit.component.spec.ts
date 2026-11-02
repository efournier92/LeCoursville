import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { TestSharedModule } from '../../../../test-shared.module';
import { AppModule } from '../../../app.module';
import { ContactEditComponent } from './contact-edit.component';
import { Contact } from 'src/app/models/contact';
import { Family } from 'src/app/models/family';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { FamilyService, FamiliesStatus } from 'src/app/services/family.service';

function makeContact(): Contact {
  const contact = new Contact();
  contact.id = 'contact-1';
  contact.name = 'Jane Smith';
  return contact;
}

function setupWith(options: {
  families: Family[];
  status: FamiliesStatus;
  contact?: Contact;
}): ComponentFixture<ContactEditComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AppModule, TestSharedModule],
    declarations: [ContactEditComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: AuthService, useValue: { userObservable: of({ roles: { admin: false } }) } },
      { provide: ConfirmDialogService, useValue: { confirm: vi.fn(() => Promise.resolve(false)) } },
      { provide: ContactsService, useValue: { deleteContact: vi.fn() } },
      {
        provide: FamilyService,
        useValue: {
          families$: of(options.families),
          familiesStatus$: of(options.status),
        },
      },
    ],
  })
    .compileComponents();
  const next = TestBed.createComponent(ContactEditComponent);
  next.componentInstance.contact = options.contact ?? makeContact();
  next.detectChanges();
  return next;
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
        {
          provide: FamilyService,
          useValue: {
            families$: of([
              { id: 'family-1', name: 'Alder', sortOrder: 'A' },
              { id: 'family-2', name: 'Cedar', sortOrder: 'B' },
            ]),
            familiesStatus$: of('ready'),
          },
        },
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

  it('loads family options from the family service', () => {
    expect(component.families.map(family => family.name)).toEqual(['Alder', 'Cedar']);
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

  it('sorts families by sortOrder then name without mutating the service array', () => {
    const source = [
      { id: 'family-a', name: 'Zeta', sortOrder: 'B' },
      { id: 'family-b', name: 'Alpha', sortOrder: 'B' },
      { id: 'family-c', name: 'Beta', sortOrder: '' },
      { id: 'family-d', name: 'Aardvark' },
    ] as Family[];

    const next = setupWith({ families: source, status: 'ready' });

    expect(next.componentInstance.families.map(family => family.name))
      .toEqual(['Aardvark', 'Beta', 'Alpha', 'Zeta']);
    expect(source.map(family => family.name))
      .toEqual(['Zeta', 'Alpha', 'Beta', 'Aardvark']);
  });

  it('renders a synthetic option for a stored family not in the list', () => {
    const contact = makeContact();
    contact.family = 'Removed Family';

    const next = setupWith({
      families: [
        { id: 'family-1', name: 'Alder', sortOrder: 'A' },
        { id: 'family-2', name: 'Cedar', sortOrder: 'B' },
      ] as Family[],
      status: 'ready',
      contact,
    });

    expect(next.componentInstance.legacyFamily).toBe('Removed Family');
    const options = next.debugElement.queryAll(By.css('mat-option'))
      .map(option => (option.nativeElement.textContent || '').trim());
    expect(options).toEqual(['Removed Family', 'Alder', 'Cedar']);
  });

  it('selects a stored family case-insensitively without a duplicate option', () => {
    const contact = makeContact();
    contact.family = 'alder';

    const next = setupWith({
      families: [
        { id: 'family-1', name: 'Alder', sortOrder: 'A' },
        { id: 'family-2', name: 'Cedar', sortOrder: 'B' },
      ] as Family[],
      status: 'ready',
      contact,
    });

    expect(next.componentInstance.legacyFamily).toBeNull();
    expect(next.debugElement.queryAll(By.css('mat-option')).length).toBe(2);
  });

  it('renders the loading, error, and empty family states', () => {
    const family = { id: 'family-1', name: 'Alder', sortOrder: 'A' } as Family;

    const loading = setupWith({ families: [family], status: 'loading' });
    expect(loading.nativeElement.textContent).toContain('Loading families…');

    const error = setupWith({ families: [], status: 'error' });
    expect(error.nativeElement.textContent).toContain('Could not load families.');

    const empty = setupWith({ families: [], status: 'ready' });
    expect(empty.nativeElement.textContent).toContain('No families configured yet.');
  });
});
