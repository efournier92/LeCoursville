import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FEATURES } from 'src/app/config/feature-config';

@Component({
  selector: 'app-feature-disabled',
  templateUrl: './feature-disabled.component.html',
  styleUrls: ['./feature-disabled.component.scss']
})
export class FeatureDisabledComponent implements OnInit {
  featureId: string = '';
  featureName: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.featureId = params['feature'] || '';
      const feature = FEATURES.find(f => f.id === this.featureId);
      this.featureName = feature ? feature.label : this.featureId;
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}