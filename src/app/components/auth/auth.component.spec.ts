import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AuthComponent } from './auth.component';
import { AuthService } from '../../services/auth.service';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [AuthComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('mapAuthError', () => {
    const map = (code: string) => (component as any).mapAuthError(code);

    it('maps invalid-action-code', () => {
      expect(map('auth/invalid-action-code')).toBe(
        'That reset link is invalid. Request a new one.'
      );
    });

    it('maps expired-action-code', () => {
      expect(map('auth/expired-action-code')).toBe(
        'That reset link has expired. Request a new one.'
      );
    });

    it('maps account-exists-with-different-credential', () => {
      expect(map('auth/account-exists-with-different-credential')).toBe(
        'An account already exists for this email. Sign in with your email and password.'
      );
    });

    it('maps popup-blocked', () => {
      expect(map('auth/popup-blocked')).toBe(
        'Your browser blocked the Google sign-in popup. Allow popups and try again.'
      );
    });

    it('maps popup-closed-by-user', () => {
      expect(map('auth/popup-closed-by-user')).toBe(
        'Google sign-in was cancelled.'
      );
    });

    it('maps operation-not-allowed', () => {
      expect(map('auth/operation-not-allowed')).toBe(
        'Google sign-in is not available right now.'
      );
    });
  });
});

// Separate module scope because AuthService is replaced with a mock: the real
// service's getRedirectResult() rejects under the test Firebase, so it would
// emit "auth/unknown" before the redirect error under test can arrive.
describe('AuthComponent redirect errors', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;
  let redirectError: BehaviorSubject<string | null>;

  beforeEach(() => {
    redirectError = new BehaviorSubject<string | null>(null);
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [AuthComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthService,
          useValue: {
            userObservable: of({}),
            authResolved$: of(false),
            redirectError$: redirectError.asObservable(),
            getCachedUser: () => null,
            isSignedOut: () => true,
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('maps a redirect error onto component.error', () => {
    redirectError.next('auth/account-exists-with-different-credential');
    expect(component.error).toBe(
      'An account already exists for this email. Sign in with your email and password.'
    );
  });
});
