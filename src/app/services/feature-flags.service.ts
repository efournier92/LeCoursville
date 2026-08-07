import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FeatureFlag } from 'src/app/models/feature-flag';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagsService {
  private readonly FEATURES_PATH = 'features';
  private flagsLoaded = false;

  private flagsSubject: BehaviorSubject<Record<string, FeatureFlag | null>> = new BehaviorSubject<Record<string, FeatureFlag | null>>({});

  constructor(private rtdb: RtdbService) {
    this.loadAllFlags();
  }

  loadAllFlags(): void {
    if (this.flagsLoaded) return;
    this.flagsLoaded = true;

    this.rtdb.object<Record<string, FeatureFlag>>(this.FEATURES_PATH).valueChanges().subscribe((flags) => {
      this.flagsSubject.next(flags || {});
    }, (error) => {
      console.error('Error loading feature flags:', error);
    });
  }

  getFeatureFlag(featureId: string): Observable<FeatureFlag | null> {
    return this.rtdb.object<FeatureFlag>(`${this.FEATURES_PATH}/${featureId}`).valueChanges();
  }

  setFeatureFlag(featureId: string, enabled: boolean): Promise<void> {
    console.log('Setting feature flag:', featureId, enabled);
    return this.rtdb.object(`${this.FEATURES_PATH}/${featureId}`).set({
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

  getPromotedRoute(): Observable<string | null> {
    // DB stores { route, updatedAt } under `promotedRoute`; emit the route string.
    return this.rtdb.object<{ route?: string }>('promotedRoute').valueChanges().pipe(
      map(v => (v && typeof v === 'object' && v.route ? v.route : null)),
    );
  }

  setPromotedRoute(route: string): Promise<void> {
    return this.rtdb.object('promotedRoute').set({
      route,
      updatedAt: Date.now(),
    });
  }
}
