import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { FEATURES, ACCOUNT_FEATURE, UPLOAD_FEATURE, FeatureConfig } from 'src/app/config/feature-config';

export interface LinkableButton {
    title: string;
    link: string;
    icon: string;
}

@Component({
    selector: 'app-navbar-links',
    templateUrl: './navbar-links.component.html',
    styleUrls: ['./navbar-links.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class NavbarLinksComponent implements OnInit {
  @Input() isMenuList: boolean;
  @Input() isSuperUser = false;
  @Input() isApproved = true;

  buttons: LinkableButton[] = [];

  flagsReady = false;

  private flagsMap: Record<string, { enabled?: boolean } | null | undefined> = {};

  /** Approval gates PII/planning links; media, photos, expressions, account
   *  and upload stay available to pending users. */
  private static readonly approvalGatedLinks = new Set(['/people', '/contacts', '/calendar']);

  get filteredButtons(): LinkableButton[] {
    return this.buttons.filter(b => {
      if (!this.isApproved && NavbarLinksComponent.approvalGatedLinks.has(b.link)) {
        return false;
      }
      if (b.link === '/') return true;
      const featureId = this.getFeatureIdFromLink(b.link);
      const flag = this.flagsMap[featureId];
      if (flag === null || flag === undefined) {
        const def = FEATURES.find(f => f.id === featureId);
        return def?.defaultEnabled !== false;
      }
      return flag.enabled === true;
    });
  }

  constructor(private featureFlagsService: FeatureFlagsService) { }

  ngOnInit(): void {
    const allButtons: LinkableButton[] = [
      ...FEATURES.map(f => ({ title: f.label, link: f.route, icon: f.icon })),
      { title: UPLOAD_FEATURE.label, link: UPLOAD_FEATURE.route, icon: UPLOAD_FEATURE.icon },
      { title: ACCOUNT_FEATURE.label, link: ACCOUNT_FEATURE.route, icon: ACCOUNT_FEATURE.icon },
    ];
    // One button per destination. View-toggle flags share a route with their
    // feature (e.g. enablePhotoAlbums -> /photos) and must not become tabs.
    const seen = new Set<string>();
    this.buttons = allButtons.filter(b => {
      if (seen.has(b.link)) {
        return false;
      }
      seen.add(b.link);
      return true;
    });
    this.featureFlagsService.flagsReady().subscribe((ready: boolean) => {
      this.flagsReady = ready;
    });
    this.featureFlagsService.getAllFeatureFlags().subscribe(flagsMap => {
      this.flagsMap = flagsMap as typeof this.flagsMap;
    });
  }

  private getFeatureIdFromLink(link: string): string {
    const feature = FEATURES.find(f => f.route === link);
    return feature ? feature.id : link;
  }

}