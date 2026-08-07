import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { UserViewComponent } from './user-view.component';
import { User } from 'src/app/models/user';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    id: 'user-123',
    dateRegistered: new Date('2020-01-02T00:00:00Z'),
    dateLastActive: new Date('2024-05-06T00:00:00Z'),
    roles: { user: true, admin: false, super: false },
    ...overrides,
  }) as User;

describe('UserViewComponent', () => {
  let component: UserViewComponent;
  let fixture: ComponentFixture<UserViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ UserViewComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('account profile card', () => {
    it('renders initials, name and email', () => {
      component.userOnCard = makeUser();
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('AL');           // initials avatar
      expect(text).toContain('Ada Lovelace'); // name
      expect(text).toContain('ada@example.com');
      expect(component.initials).toBe('AL');
    });

    it('falls back to "?" when name is empty', () => {
      component.userOnCard = makeUser({ name: '   ' });
      expect(component.initials).toBe('?');
    });

    it('shows registered and last-active dates', () => {
      component.userOnCard = makeUser();
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('Registered');
      expect(text).toContain('2020');
      expect(text).toContain('Last active');
      expect(text).toContain('2024');
    });

    it('renders role chips for admin users', () => {
      component.userOnCard = makeUser({ roles: { user: true, admin: true, super: true } });
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('Admin');
      expect(text).toContain('Super');
      expect(text).toContain('User');
    });

    it('does not render roles for non-admin users', () => {
      component.userOnCard = makeUser();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Admin');
    });

    it('emits editClickedEvent on edit click', () => {
      component.userOnCard = makeUser();
      fixture.detectChanges();

      let edited = false;
      component.editClickedEvent.subscribe(() => (edited = true));
      const button = (fixture.nativeElement as HTMLElement).querySelector('button');
      expect(button).toBeTruthy();
      button!.click();
      expect(edited).toBe(true);
    });
  });
});
