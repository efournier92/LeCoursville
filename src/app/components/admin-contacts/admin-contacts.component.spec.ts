import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, concat } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminContactsComponent } from './admin-contacts.component';
import { ContactsService } from 'src/app/services/contacts.service';
import { RtdbService } from 'src/app/services/rtdb.service';
import { FamilyService } from 'src/app/services/family.service';
import { Contact } from 'src/app/models/contact';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

function makeContact(id: string, name: string): Contact {
  const contact = new Contact();
  contact.id = id;
  contact.name = name;
  return contact;
}

describe('AdminContactsComponent', () => {
  let component: AdminContactsComponent;
  let fixture: ComponentFixture<AdminContactsComponent>;
  const contact = makeContact('contact-1', 'Legacy Contact One');

  function createWithId(id: string | null): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [AdminContactsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(id ? { id } : {})) },
        },
        // The component skips the BehaviorSubject's synchronous [] seed
        // (C-20261031-08), so feed the seed followed by the real emission.
        { provide: ContactsService, useValue: { userContacts: concat(of([]), of([contact, makeContact('contact-2', 'Legacy Contact Two')])) } },
        { provide: RtdbService, useValue: { object: () => ({ valueChanges: () => of(contact) }) } },
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
    }).compileComponents();
    fixture = TestBed.createComponent(AdminContactsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('lists contacts sorted by name with links to the detail route', () => {
    createWithId(null);
    const rows = fixture.nativeElement.querySelectorAll('.admin-contacts-row');
    expect(rows.length).toBe(2);
    // Sorted by name: Legacy Contact One sorts before Legacy Contact Two.
    expect(rows[0].textContent).toContain('Legacy Contact One');
    expect(component.contactId).toBeNull();
  });

  it('loads the :id contact and renders the reused contact-edit surface', () => {
    createWithId('contact-1');
    expect(component.contactId).toBe('contact-1');
    expect(fixture.nativeElement.querySelector('app-contact-edit')).not.toBeNull();
  });
});
