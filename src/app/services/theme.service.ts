import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { Theme } from 'src/app/models/user';

/**
 * Owns the per-user light/dark theme: reads `users/{uid}/prefs/theme` via the
 * AuthService user stream, applies it to the document element, and writes
 * toggles back through AuthService.updateUser (full-object write — the RTDB
 * rules predicate requires email and roles preserved). Light is the floor for
 * every unknown state; the OS color scheme setting is deliberately ignored.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  theme$: Observable<Theme>;

  constructor(private authService: AuthService) {
    this.theme$ = this.authService.userObservable.pipe(
      map((user: any) => (user?.prefs?.theme === 'dark' ? 'dark' : 'light')),
    );
    this.theme$.subscribe((theme) => this.apply(theme));
    // The user stream never emits on sign-out; authResolved$ fires then, so
    // clear the attribute there to keep guests light.
    this.authService.authResolved$.subscribe(() => {
      if (this.authService.isSignedOut()) {
        this.apply('light');
      }
    });
  }

  toggle(): void {
    const next: Theme =
      this.authService.user?.prefs?.theme === 'dark' ? 'light' : 'dark';
    this.apply(next);
    this.authService.updateUser({
      ...this.authService.user,
      prefs: { theme: next },
    });
  }

  private apply(theme: Theme): void {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
}
