import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { FeatureFlag } from 'src/app/models/feature-flag';

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagsService {
  private readonly FEATURES_PATH = 'features';
  private flagsLoaded = false;

  private flagsSubject: BehaviorSubject<Record<string, FeatureFlag | null>> = new BehaviorSubject<Record<string, FeatureFlag | null>>({});

  constructor(private db: AngularFireDatabase) {
    this.loadAllFlags();
  }

  loadAllFlags(): void {
    if (this.flagsLoaded) return;
    this.flagsLoaded = true;

    this.db.object(this.FEATURES_PATH).valueChanges().subscribe((flags: Record<string, FeatureFlag> | null) => {
      console.log('Loaded feature flags:', flags);
      this.flagsSubject.next(flags || {});
    }, (error) => {
      console.error('Error loading feature flags:', error);
    });
  }

  getFeatureFlag(featureId: string): Observable<FeatureFlag | null> {
    return this.db.object(`${this.FEATURES_PATH}/${featureId}`).valueChanges() as Observable<FeatureFlag | null>;
  }

  setFeatureFlag(featureId: string, enabled: boolean): Promise<void> {
    console.log('Setting feature flag:', featureId, enabled);
    return this.db.object(`${this.FEATURES_PATH}/${featureId}`).set({
      enabled,
      updatedAt: Date.now(),
    }).catch(error => {
      console.error('Error setting feature flag:', error);
      throw error;
    });
  }

  getAllFeatureFlags(): Observable<Record<string, FeatureFlag | null>> {
    return this.flagsSubject.asObservable();
  }

  getEnabledFeatures(): string[] {
    const flags = this.flagsSubject.getValue();
    const toggleableFeatureIds = ['expressions', 'music', 'videos', 'calendar', 'contacts', 'photos', 'chat'];
    return toggleableFeatureIds.filter(id => {
      const flag = flags[id];
      return flag === null || flag === undefined || flag.enabled === true;
    });
  }
}