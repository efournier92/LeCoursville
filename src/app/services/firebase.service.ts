import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, Database, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';
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
  analytics: Analytics | null = null;

  constructor() {
    const env = environment as unknown as EmulatorSwitches;
    const useEmulators = env.useEmulators === true;
    this.app = initializeApp(environment.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getDatabase(this.app);
    this.storage = getStorage(this.app);
    if (useEmulators && env.emulator) {
      connectAuthEmulator(this.auth, env.emulator.auth, { disableWarnings: true });
      connectDatabaseEmulator(this.db, env.emulator.database.host, env.emulator.database.port);
      connectStorageEmulator(this.storage, env.emulator.storage.host, env.emulator.storage.port);
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
