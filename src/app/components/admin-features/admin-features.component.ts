import { ChangeDetectorRef, Component, OnDestroy, OnInit, ChangeDetectionStrategy, QueryList, ViewChildren } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';
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
  toggleError = '';
  // One-way [checked] bindings only repaint when the value changes, so a failed
  // write is pushed back through the live toggle instances.
  @ViewChildren(MatSlideToggle) private toggles?: QueryList<MatSlideToggle>;

  private readySub?: Subscription;
  private flagsSub?: Subscription;
  private promotedSub?: Subscription;

  constructor(
    private featureFlagsService: FeatureFlagsService,
    private changeDetector: ChangeDetectorRef,
  ) { }

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

  async onToggle(featureId: string, enabled: boolean): Promise<void> {
    this.toggleError = '';
    const stored = this.isEnabled(featureId);
    try {
      await this.featureFlagsService.setFeatureFlag(featureId, enabled);
    } catch {
      const label = FEATURES.find(feature => feature.id === featureId)?.label || featureId;
      this.toggleError = `Couldn’t save “${label}”. The toggle was reverted.`;
      const toggle = this.toggles?.find(item => item.id === `feature-id-${featureId}`);
      if (toggle) {
        // The click already left the control showing the failed value; flip the
        // binding once so the restore to `stored` is a visible change.
        toggle.checked = !stored;
        this.changeDetector.detectChanges();
        toggle.checked = stored;
        this.changeDetector.detectChanges();
      }
    }
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
