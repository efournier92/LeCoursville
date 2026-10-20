import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { FeatureFlag } from 'src/app/models/feature-flag';
import { FEATURES, FeatureConfig } from 'src/app/config/feature-config';

interface FeatureGroup {
  label: string;
  features: FeatureConfig[];
}

// Surfaces the toggles belong to. FEATURES stays the source of truth; this only
// decides which section each entry renders under.
const FEATURE_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'People', ids: ['people', 'contacts'] },
  { label: 'Content', ids: ['calendar', 'music', 'videos', 'photos', 'enablePhotoAlbums', 'expressions'] },
  { label: 'System', ids: ['chat'] },
];

@Component({
    selector: 'app-admin-features',
    templateUrl: './admin-features.component.html',
    styleUrls: ['./admin-features.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminFeaturesComponent implements OnInit, OnDestroy {
  flagsMap: Record<string, FeatureFlag | null> = {};
  featureDefs: FeatureConfig[] = FEATURES;
  featureGroups: FeatureGroup[] = FEATURE_GROUPS.map(group => ({
    label: group.label,
    features: group.ids
      .map(id => FEATURES.find(feature => feature.id === id))
      .filter((feature): feature is FeatureConfig => !!feature),
  }));
  promotedRoute: string = '';
  featureOptions = FEATURES;
  loading = true;
  loadError = '';

  private readySub?: Subscription;
  private flagsSub?: Subscription;
  private promotedSub?: Subscription;

  constructor(private featureFlagsService: FeatureFlagsService) { }

  ngOnInit(): void {
    this.readySub = this.featureFlagsService.flagsReady().subscribe(ready => {
      this.loading = !ready;
      if (ready) {
        this.loadFlags();
      }
    });

    this.promotedSub = this.featureFlagsService.getPromotedRoute().subscribe((data: any) => {
      this.promotedRoute = data?.route || '';
    });
  }

  ngOnDestroy(): void {
    this.readySub?.unsubscribe();
    this.flagsSub?.unsubscribe();
    this.promotedSub?.unsubscribe();
  }

  retry(): void {
    this.flagsSub?.unsubscribe();
    this.flagsSub = undefined;
    this.loadError = '';
    this.loading = true;
    this.loadFlags();
  }

  isEnabled(featureId: string): boolean {
    const flag = this.flagsMap[featureId];
    if (flag === null || flag === undefined) {
      const def = FEATURES.find(f => f.id === featureId);
      return def?.defaultEnabled !== false;
    }
    return flag.enabled === true;
  }

  onToggle(featureId: string, enabled: boolean): void {
    this.featureFlagsService.setFeatureFlag(featureId, enabled);
  }

  onPromotedRouteChange(route: string): void {
    this.featureFlagsService.setPromotedRoute(route);
  }

  private loadFlags(): void {
    if (this.flagsSub) {
      return;
    }
    this.flagsSub = this.featureFlagsService.getAllFeatureFlags().subscribe({
      next: flagsMap => {
        this.flagsMap = flagsMap;
        this.loading = false;
      },
      error: () => {
        this.loadError = 'Could not load feature flags.';
        this.loading = false;
      },
    });
  }
}
