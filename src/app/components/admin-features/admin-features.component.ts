import { Component, OnInit } from '@angular/core';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { FeatureFlag } from 'src/app/models/feature-flag';
import { FEATURES, FeatureConfig } from 'src/app/config/feature-config';

@Component({
  selector: 'app-admin-features',
  templateUrl: './admin-features.component.html',
  styleUrls: ['./admin-features.component.scss']
})
export class AdminFeaturesComponent implements OnInit {
  flagsMap: Record<string, FeatureFlag | null> = {};
  featureDefs: FeatureConfig[] = FEATURES;

  constructor(private featureFlagsService: FeatureFlagsService) { }

  ngOnInit(): void {
    this.featureFlagsService.getAllFeatureFlags().subscribe(flagsMap => {
      this.flagsMap = flagsMap;
    });
  }

  isEnabled(featureId: string): boolean {
    const flag = this.flagsMap[featureId];
    return flag === null || flag === undefined || flag.enabled === true;
  }

  onToggle(featureId: string, enabled: boolean): void {
    this.featureFlagsService.setFeatureFlag(featureId, enabled);
  }
}