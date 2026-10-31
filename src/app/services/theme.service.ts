import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, distinctUntilChanged } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { Theme } from 'src/app/models/user';

/** Per-tab key for the toolbar's session-only override. */
const SESSION_KEY = 'lecoursville.theme.session';

/**
 * Owns light/dark. Two layers:
 *
 * - The account preference (`users/{uid}/prefs/theme`) is the durable
 *   "Always use dark mode" setting saved from the account page.
 * - The toolbar toggle writes only a session-scoped override (sessionStorage):
 *   it never touches the account, so an accidental tap lasts until the tab
 *   closes and can never strand someone in a mode they did not choose.
 *
 * Effective theme = session override, else the account preference. Light is
 * the floor for every unknown state; the OS color scheme is deliberately
 * ignored.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly authService = inject(AuthService);

  /** Durable account preference. */
  private readonly accountTheme$: Observable<Theme> = this.authService.userObservable.pipe(
    map((user: any) => (user?.prefs?.theme === 'dark' ? 'dark' : 'light')),
  );

  /** Session-only override; null means "follow the account preference". */
  private readonly sessionOverride$ = new BehaviorSubject<Theme | null>(
    this.readSessionOverride(),
  );

  /** Effective theme: the session override wins over the account preference. */
  readonly theme$: Observable<Theme> = combineLatest([
    this.accountTheme$,
    this.sessionOverride$,
  ]).pipe(
    map(([account, override]) => override ?? account),
    distinctUntilChanged(),
  );

  private effectiveTheme: Theme = 'light';

  constructor() {
    this.theme$.subscribe((theme) => this.apply(theme));
    // The user stream never emits on sign-out; drop the attribute and the
    // session override so the next sign-in in this tab starts clean rather
    // than inheriting the previous user's choice.
    this.authService.authResolved$.subscribe(() => {
      if (this.authService.isSignedOut()) {
        this.clearSessionOverride();
        this.apply('light');
      }
    });
  }

  /** Toolbar toggle: session-only, never writes to the account. */
  toggle(): void {
    this.setSessionTheme(this.effectiveTheme === 'dark' ? 'light' : 'dark');
  }

  /** Persist the account-level "Always use dark mode" preference. */
  setAccountTheme(theme: Theme): void {
    this.authService.updateUser({
      ...this.authService.user,
      prefs: { ...this.authService.user?.prefs, theme },
    });
  }

  /** Drop the session override so the saved account preference takes effect. */
  clearSessionOverride(): void {
    this.sessionOverride$.next(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage unavailable (private mode, embedded webview): stay in-memory.
    }
  }

  private setSessionTheme(theme: Theme): void {
    this.sessionOverride$.next(theme);
    try {
      sessionStorage.setItem(SESSION_KEY, theme);
    } catch {
      // Storage unavailable: the override still applies for this page.
    }
  }

  private readSessionOverride(): Theme | null {
    try {
      const value = sessionStorage.getItem(SESSION_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }

  private apply(theme: Theme): void {
    this.effectiveTheme = theme;
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
}
