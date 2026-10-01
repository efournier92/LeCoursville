import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, Database, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';
import { environment } from 'src/environments/environment';

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
    this.app = initializeApp(environment.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getDatabase(this.app);
    this.storage = getStorage(this.app);
    if (environment.useEmulators && environment.emulator) {
      connectAuthEmulator(this.auth, environment.emulator.auth, { disableWarnings: true });
      connectDatabaseEmulator(this.db, environment.emulator.database.host, environment.emulator.database.port);
      connectStorageEmulator(this.storage, environment.emulator.storage.host, environment.emulator.storage.port);
    }
    if (typeof window !== 'undefined' && !environment.useEmulators) {
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
