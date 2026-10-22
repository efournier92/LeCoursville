import { ChangeDetectorRef, Component, OnDestroy, OnInit, ChangeDetectionStrategy, QueryList, ViewChildren } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { Subscription } from 'rxjs';
import { FeatureFlagsService, FeatureFlagAuditRecord } from 'src/app/services/feature-flags.service';
import { FeatureFlag } from 'src/app/models/feature-flag';
import { FEATURES, FeatureConfig } from 'src/app/config/feature-config';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

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

  private userSignedIn: User;
  private storedPromotedRoute = '';
  private readySub?: Subscription;
  private flagsSub?: Subscription;
  private promotedSub?: Subscription;
  private userSub?: Subscription;

  constructor(
    private featureFlagsService: FeatureFlagsService,
    private authService: AuthService,
    private changeDetector: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.readySub = this.featureFlagsService.flagsReady().subscribe(ready => {
      this.loading = !ready;
      if (ready) {
        this.loadFlags();
      }
    });

    this.promotedSub = this.featureFlagsService.getPromotedRoute().subscribe(route => {
      this.storedPromotedRoute = route || '';
      this.promotedRoute = this.storedPromotedRoute;
    });

    this.userSub = this.authService.userObservable.subscribe((user: User) => {
      this.userSignedIn = user;
    });
  }

  ngOnDestroy(): void {
    this.readySub?.unsubscribe();
    this.flagsSub?.unsubscribe();
    this.promotedSub?.unsubscribe();
    this.userSub?.unsubscribe();
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
      return;
    }
    this.writeAudit({ flagId: featureId, enabled, previous: stored });
  }

  async onPromotedRouteChange(route: string): Promise<void> {
    this.toggleError = '';
    const stored = this.storedPromotedRoute;
    try {
      await this.featureFlagsService.setPromotedRoute(route);
    } catch {
      this.promotedRoute = stored;
      this.toggleError = 'Couldn’t save the promoted route. The selection was reverted.';
      return;
    }
    const feature = this.featureForRoute(route);
    // A route has no boolean of its own, so the matched flag's state records
    // whether the promoted page is live at the moment it was chosen.
    this.writeAudit({
      flagId: feature?.id ?? 'promotedRoute',
      enabled: feature ? this.isEnabled(feature.id) : false,
      previous: feature ? this.isEnabled(feature.id) : false,
    });
  }

  get promotedRouteWarning(): string {
    const selected = this.disabledRouteWarning(this.promotedRoute);
    if (selected) {
      return selected;
    }
    if (this.storedPromotedRoute !== this.promotedRoute) {
      return this.disabledRouteWarning(this.storedPromotedRoute);
    }
    return '';
  }

  changedLabel(featureId: string): string {
    const updatedAt = this.flagsMap[featureId]?.updatedAt;
    if (!updatedAt) {
      return '';
    }
    const minutes = Math.floor((Date.now() - updatedAt) / 60000);
    const relative = minutes < 1
      ? 'just now'
      : minutes < 60
        ? `${minutes}m ago`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)}h ago`
          : `${Math.floor(minutes / 1440)}d ago`;
    return `changed ${relative}`;
  }

  private disabledRouteWarning(route: string): string {
    if (!route) {
      return '';
    }
    const feature = this.featureForRoute(route);
    if (!feature || this.isEnabled(feature.id)) {
      return '';
    }
    return `${feature.label} is currently off, so members will land on the feature-disabled page.`;
  }

  private featureForRoute(route: string): FeatureConfig | undefined {
    return FEATURES.find(feature => feature.route === route);
  }

  private writeAudit(change: { flagId: string; enabled: boolean; previous: boolean }): void {
    const record: FeatureFlagAuditRecord = {
      ...change,
      actorId: this.userSignedIn?.id || '',
      actorEmail: this.userSignedIn?.email || '',
      at: Date.now(),
    };
    // The audit trail must never hold up the switch it records.
    this.featureFlagsService
      .addFeatureFlagAudit(record)
      .catch(error => console.error('Error writing feature flag audit:', error));
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
