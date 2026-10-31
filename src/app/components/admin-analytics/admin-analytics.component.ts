import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CloudFunctionsService, AnalyticsSummary } from 'src/app/services/cloud-functions.service';

type AnalyticsState = 'loading' | 'ready' | 'error';

@Component({
    selector: 'app-admin-analytics',
    templateUrl: './admin-analytics.component.html',
    styleUrls: ['./admin-analytics.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminAnalyticsComponent implements OnInit {
  state: AnalyticsState = 'loading';
  summary: AnalyticsSummary | null = null;
  errorMessage = '';

  constructor(private cloudFunctions: CloudFunctionsService) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state = 'loading';
    this.cloudFunctions.adminAnalyticsSummary()
      .then(summary => {
        this.summary = summary;
        this.state = 'ready';
      })
      .catch(() => {
        this.errorMessage = 'Analytics data is unavailable.';
        this.state = 'error';
      });
  }
}
