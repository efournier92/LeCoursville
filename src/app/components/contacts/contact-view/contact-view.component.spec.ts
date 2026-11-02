import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { TestSharedModule } from '../../../../test-shared.module';
import { AppModule } from '../../../app.module';
import { ContactViewComponent } from './contact-view.component';
import { Contact } from 'src/app/models/contact';
import { AuthService } from 'src/app/services/auth.service';

function makeContact(): Contact {
  const contact = new Contact();
  contact.id = 'contact-1';
  contact.name = 'Jane Smith';
  contact.family = 'Smith';
  contact.emails = [{ address: 'jane@example.com', info: 'Email' }];
  contact.phones = [{ number: '555-1234', info: 'Phone' }];
  return contact;
}

describe('ContactViewComponent', () => {
  let component: ContactViewComponent;
  let fixture: ComponentFixture<ContactViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ContactViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        // Even an admin sees no edit footer: contact editing lives behind
        // /admin/contacts/:id (read-only user surface).
        { provide: AuthService, useValue: { userObservable: of({ roles: { admin: true } }) } },
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactViewComponent);
    component = fixture.componentInstance;
    component.contact = makeContact();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the contact name', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Jane Smith');
  });

  it('renders no edit footer regardless of roles', () => {
    expect(fixture.nativeElement.querySelector('mat-card-footer')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('edit');
  });
});
