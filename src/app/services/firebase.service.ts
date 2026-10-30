import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getDatabase, Database, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { environment } from 'src/environments/environment';

/**
 * Every file under `src/environments/` is gitignored (they carry real Firebase
 * configs), so their shape varies per machine and per age. Read the emulator
 * switches structurally: an environment without them (an older `environment.prod.ts`,
 * a fresh clone's `environment.ts`) must still compile, and must never connect
 * to an emulator.
 */
type EmulatorSwitches = {
  useEmulators?: boolean;
  appCheckSiteKey?: string;
  emulator?: {
    auth: string;
    database: { host: string; port: number };
    storage: { host: string; port: number };
  };
};

/**
 * Single Firebase app instance for the whole application, exposed through the
 * framework-agnostic modular SDK (v9+). Replaces AngularFire compat modules,
 * which are in maintenance and do not support Angular 17+ peers.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Database;
  readonly storage: FirebaseStorage;
  readonly functions: Functions;
  analytics: Analytics | null = null;

  constructor() {
    const env = environment as unknown as EmulatorSwitches;
    const useEmulators = env.useEmulators === true;
    this.app = initializeApp(environment.firebaseConfig);
    this.auth = getAuth(this.app);
    // Keep the session in localStorage explicitly (the SDK default) so it
    // survives reloads instead of living only for the tab.
    void setPersistence(this.auth, browserLocalPersistence).catch(() => {
      // Storage can be unavailable (private mode); the in-memory fallback
      // still lets the current tab work.
    });
    if (env.appCheckSiteKey) {
      try {
        if (useEmulators) {
          // firebase/app-check has no exported debug provider; its built-in
          // debug mode takes over once this global is set, exchanging the
          // token with the emulator instead of calling reCAPTCHA.
          const globals = self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean };
          globals.FIREBASE_APPCHECK_DEBUG_TOKEN ??= 'lecoursville-e2e-appcheck-debug';
        }
        initializeAppCheck(this.app, {
          provider: new ReCaptchaV3Provider(env.appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch {
        // App Check is defense-in-depth; a failed init must never block boot.
      }
    }
    this.db = getDatabase(this.app);
    this.storage = getStorage(this.app);
    this.functions = getFunctions(this.app, 'us-central1');
    if (useEmulators && env.emulator) {
      connectAuthEmulator(this.auth, env.emulator.auth, { disableWarnings: true });
      connectDatabaseEmulator(this.db, env.emulator.database.host, env.emulator.database.port);
      connectStorageEmulator(this.storage, env.emulator.storage.host, env.emulator.storage.port);
      connectFunctionsEmulator(this.functions, '127.0.0.1', 5001);
    }
    if (typeof window !== 'undefined' && !useEmulators) {
      // Analytics is optional at runtime (e.g. unsupported webviews); resolve
      // asynchronously so app init never blocks on it. Skipped in emulator
      // mode: there is no analytics emulator, and the gate asserts zero
      // console errors, so analytics init would be pure noise.
      isSupported().then(supported => {
        if (supported) {
          this.analytics = getAnalytics(this.app);
        }
      }).catch(() => {});
    }
  }
}
