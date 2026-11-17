import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CloudFunctionsService, AnalyticsSummary, AnalyticsDailyPoint } from 'src/app/services/cloud-functions.service';

type AnalyticsState = 'loading' | 'ready' | 'error';

interface DateLabel {
  text: string;
}

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

  get daily(): AnalyticsDailyPoint[] {
    return this.summary?.daily ?? [];
  }

  get trendMax(): number {
    return this.daily.reduce(
      (max, point) => Math.max(max, point.users, point.sessions),
      0,
    );
  }

  get sessionsPoints(): string {
    return this.seriesPoints(this.daily.map(point => point.sessions), this.trendMax);
  }

  get usersPoints(): string {
    return this.seriesPoints(this.daily.map(point => point.users), this.trendMax);
  }

  get sessionsArea(): string {
    return this.areaPath(this.sessionsPoints);
  }

  get gridlineYs(): number[] {
    return [0.25, 0.5, 0.75, 1].map(fraction => this.chartY(fraction));
  }

  get dateLabels(): DateLabel[] {
    const points = this.daily;
    const count = points.length;
    if (count === 0) {
      return [];
    }
    const last = count - 1;
    const seen = new Set<string>();
    return [0, Math.floor(last / 2), last]
      .filter(index => {
        const text = points[index].date;
        if (seen.has(text)) {
          return false;
        }
        seen.add(text);
        return true;
      })
      .map((index): DateLabel => ({
        text: points[index].date,
      }));
  }

  get trendAriaLabel(): string {
    const peak = this.peakDay;
    if (!peak || !this.summary) {
      return 'Sessions and users trend';
    }
    return `Sessions and users from ${this.summary.range.start} to ${this.summary.range.end}. Peak day ${peak.date} with ${peak.sessions} sessions.`;
  }

  get peakDay(): AnalyticsDailyPoint | null {
    return this.daily.reduce<AnalyticsDailyPoint | null>(
      (peak, point) => (!peak || point.sessions > peak.sessions ? point : peak),
      null,
    );
  }

  get topPageValue(): number {
    return this.summary?.topPages[0]?.value ?? 0;
  }

  get topEventValue(): number {
    return this.summary?.topEvents[0]?.value ?? 0;
  }

  get insight(): string {
    if (!this.summary) {
      return '';
    }
    const topPage = this.summary.topPages[0];
    const pageViews = this.summary.totals.pageViews
      || this.summary.topPages.reduce((total, row) => total + row.value, 0);
    const share = this.formatPercent(this.percent(topPage?.value ?? 0, pageViews) / 100);
    const peak = this.peakDay;
    const lead = topPage
      ? `${topPage.label} leads with ${share} of page views.`
      : 'No page data is available.';
    const peakLine = peak
      ? ` ${peak.date} peaked at ${peak.sessions} sessions.`
      : '';
    return `${lead}${peakLine}`;
  }

  seriesPoints(values: number[], max: number): string {
    if (values.length === 0) {
      return '';
    }
    return values.map((value, index) => {
      const x = this.seriesX(index, values.length);
      return `${x},${this.chartY(max === 0 ? 0 : value / max)}`;
    }).join(' ');
  }

  areaPath(points: string): string {
    if (!points) {
      return '';
    }
    const coords = points.split(' ');
    const firstX = coords[0].split(',')[0];
    const lastX = coords[coords.length - 1].split(',')[0];
    const baseline = this.chartY(0);
    return `M${firstX},${baseline} L${coords.join(' L')} L${lastX},${baseline} Z`;
  }

  percent(value: number, total: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (value / total) * 100));
  }

  formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds || 0));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, '0')}`;
  }

  formatPercent(fraction: number): string {
    const value = Number.isFinite(fraction) ? fraction : 0;
    return `${(value * 100).toFixed(1)}%`;
  }

  deviceShare(value: number): number {
    const total = this.deviceDenominator;
    return total === 0 ? 0 : value / total;
  }

  get deviceDenominator(): number {
    const sessions = this.summary?.totals.sessions ?? 0;
    return sessions > 0
      ? sessions
      : (this.summary?.devices ?? []).reduce((total, row) => total + row.value, 0);
  }

  private seriesX(index: number, count: number): number {
    return count <= 1 ? 0 : (index / (count - 1)) * 720;
  }

  private chartY(fraction: number): number {
    return 188 - fraction * 180;
  }
}
