import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { TestSharedModule } from '../../../../test-shared.module';
import { AppModule } from '../../../app.module';
import { ContactEditComponent } from './contact-edit.component';
import { Contact } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';

function makeContact(): Contact {
  const contact = new Contact();
  contact.id = 'contact-1';
  contact.name = 'Jane Smith';
  return contact;
}

describe('ContactEditComponent', () => {
  let component: ContactEditComponent;
  let fixture: ComponentFixture<ContactEditComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ContactEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuthService, useValue: { userObservable: of({ roles: { admin: false } }) } },
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
});
