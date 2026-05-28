import { Component, Input, OnInit } from '@angular/core';
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
  styleUrls: ['./navbar-links.component.scss']
})
export class NavbarLinksComponent implements OnInit {
  @Input() isMenuList: boolean;

  buttons: LinkableButton[] = [
    ...FEATURES.map(f => ({ title: f.label, link: f.route, icon: f.icon })),
    { title: UPLOAD_FEATURE.label, link: UPLOAD_FEATURE.route, icon: UPLOAD_FEATURE.icon },
    { title: ACCOUNT_FEATURE.label, link: ACCOUNT_FEATURE.route, icon: ACCOUNT_FEATURE.icon },
  ];

  filteredButtons: LinkableButton[] = [];

  constructor(private featureFlagsService: FeatureFlagsService) { }

  ngOnInit(): void {
    this.featureFlagsService.getAllFeatureFlags().subscribe(flagsMap => {
      this.filteredButtons = this.buttons.filter(b => {
        if (b.link === '/') return true;
        const featureId = this.getFeatureIdFromLink(b.link);
        const flag = flagsMap[featureId];
        return flag === null || flag === undefined || flag.enabled === true;
      });
    });
  }

  private getFeatureIdFromLink(link: string): string {
    const feature = FEATURES.find(f => f.route === link);
    return feature ? feature.id : link;
  }

}