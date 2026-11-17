import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import {
  CloudFunctionsService,
  AnalyticsDailyPoint,
  AnalyticsSummary,
} from 'src/app/services/cloud-functions.service';
import { AdminAnalyticsComponent } from './admin-analytics.component';

const makeSummary = (): AnalyticsSummary => ({
  source: 'fixture',
  range: { days: 30, start: '2026-01-01', end: '2026-01-30' },
  totals: {
    users: 1204,
    sessions: 3567,
    pageViews: 12040,
    bounceRate: 0.416,
    avgSessionSeconds: 96,
    newUsers: 812,
  },
  daily: [],
  topPages: [],
  topEvents: [],
  devices: [],
});

const makePoint = (date: string, sessions: number, users = sessions): AnalyticsDailyPoint => ({
  date,
  sessions,
  users,
});

describe('AdminAnalyticsComponent', () => {
  let component: AdminAnalyticsComponent;
  let fixture: ComponentFixture<AdminAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      providers: [
        {
          provide: CloudFunctionsService,
          useValue: { adminAnalyticsSummary: vi.fn(() => Promise.resolve(makeSummary())) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAnalyticsComponent);
    component = fixture.componentInstance;
  });

  it('maps a normal series across the full viewBox width', () => {
    expect(component.seriesPoints([0, 5, 10], 10)).toBe('0,188 360,98 720,8');
  });

  it('keeps a zero-max series on the flat baseline without NaN', () => {
    const points = component.seriesPoints([0, 0, 0], 0);
    expect(points).toBe('0,188 360,188 720,188');
  });

  it('places a single point at the left edge', () => {
    expect(component.seriesPoints([4], 4)).toBe('0,8');
  });

  it('derives date labels from indices and dedupes short series', () => {
    const daily = Array.from({ length: 30 }, (_, index) =>
      makePoint(`2026-01-${String(index + 1).padStart(2, '0')}`, index));
    component.summary = { ...makeSummary(), daily };

    const labels = component.dateLabels;
    expect(labels.map(label => label.text)).toEqual([
      daily[0].date,
      daily[14].date,
      daily[29].date,
    ]);

    component.summary = { ...makeSummary(), daily: [makePoint('2026-01-01', 1)] };
    expect(component.dateLabels.map(label => label.text)).toEqual(['2026-01-01']);

    component.summary = {
      ...makeSummary(),
      daily: [makePoint('2026-01-01', 1), makePoint('2026-01-02', 2)],
    };
    expect(component.dateLabels.map(label => label.text)).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('clamps percent above 100 and below 0 and returns 0 for a zero total', () => {
    expect(component.percent(150, 100)).toBe(100);
    expect(component.percent(-10, 100)).toBe(0);
    expect(component.percent(5, 0)).toBe(0);
  });

  it('formats durations and fractions', () => {
    expect(component.formatDuration(96)).toBe('1:36');
    expect(component.formatDuration(0)).toBe('0:00');
    expect(component.formatPercent(0.416)).toBe('41.6%');
  });

  it('divides device share by sessions, falling back to the returned-row sum', () => {
    component.summary = {
      ...makeSummary(),
      totals: { ...makeSummary().totals, sessions: 1000 },
      devices: [{ label: 'desktop', value: 250 }, { label: 'mobile', value: 250 }],
    };
    expect(component.deviceShare(250)).toBe(0.25);

    component.summary = {
      ...makeSummary(),
      totals: { ...makeSummary().totals, sessions: 0 },
      devices: [{ label: 'desktop', value: 250 }, { label: 'mobile', value: 250 }],
    };
    expect(component.deviceShare(250)).toBe(0.5);
  });

  it('builds an insight sentence with the top page share and peak day', () => {
    component.summary = {
      ...makeSummary(),
      totals: { ...makeSummary().totals, pageViews: 1000 },
      topPages: [{ label: '/calendar', value: 500 }],
      daily: [makePoint('2026-01-01', 10), makePoint('2026-01-02', 20)],
    };

    expect(component.insight).toContain('/calendar leads with 50.0% of page views.');
    expect(component.insight).toContain('2026-01-02 peaked at 20 sessions.');
  });

  it('does not throw on an empty topPages array', () => {
    component.summary = { ...makeSummary(), daily: [], topPages: [] };
    expect(component.insight).toBe('No page data is available.');
  });
});
