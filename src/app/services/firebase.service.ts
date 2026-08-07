import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
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
    if (typeof window !== 'undefined') {
      // Analytics is optional at runtime (e.g. unsupported webviews); resolve
      // asynchronously so app init never blocks on it.
      isSupported().then(supported => {
        if (supported) {
          this.analytics = getAnalytics(this.app);
        }
      }).catch(() => {});
    }
  }
}
