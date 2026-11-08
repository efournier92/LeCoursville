import { Component, OnInit, OnDestroy, Inject, Optional, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Calendar } from 'src/app/models/calendar';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { RtdbService } from 'src/app/services/rtdb.service';

@Component({
    selector: 'app-calendar-printer',
    templateUrl: './calendar-printer.component.html',
    styleUrls: ['./calendar-printer.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CalendarPrinterComponent implements OnInit, OnDestroy {
  availableYears: number[] = [];
  selectedYear: number | null = null;
  calendarUrl: string | null = null;
  loading = false;
  loadError = false;

  private yearsSub: Subscription | null = null;
  private urlSub: Subscription | null = null;

  constructor(
    public dialogRef: MatDialogRef<CalendarPrinterComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: { filtersSummary?: string } | null,
    private rtdb: RtdbService,
    private analyticsService: AnalyticsService,
  ) {}

  get filtersSummary(): string {
    return this.data?.filtersSummary ?? '';
  }

  ngOnInit(): void {
    this.loadAvailableYears();
    this.analyticsService.logEvent('component_load_calendar_printer', {});
  }

  ngOnDestroy(): void {
    this.yearsSub?.unsubscribe();
    this.urlSub?.unsubscribe();
  }

  retryLoad(): void {
    this.loadAvailableYears();
  }

  private loadAvailableYears(): void {
    this.loading = true;
    this.loadError = false;
    const thisYear = new Date().getFullYear();
    const maxYears = [thisYear, thisYear + 1, thisYear + 2];

    this.yearsSub?.unsubscribe();
    this.yearsSub = this.rtdb.list<Calendar>('calendars').valueChanges().subscribe({
      next: calendars => {
        const configuredYears = new Set(
          calendars.map(c => parseInt(c.year)).filter(y => !isNaN(y))
        );

        this.availableYears = maxYears.filter(y => configuredYears.has(y));

        if (this.availableYears.length > 0 && !this.selectedYear) {
          this.selectedYear = this.availableYears[0];
          this.loadCalendarUrl();
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    this.calendarUrl = null;
    this.loadCalendarUrl();
  }

  private loadCalendarUrl(): void {
    if (!this.selectedYear) return;
    const year = this.selectedYear;
    this.urlSub?.unsubscribe();
    this.urlSub = this.rtdb.object<{ url: string }>(`/calendars/cal-${year}`).valueChanges().pipe(
      map(cal => cal?.url || null)
    ).subscribe(url => {
      if (year !== this.selectedYear) return;
      this.calendarUrl = url;
    });
  }

  openPrint(): void {
    if (!this.calendarUrl) return;
    this.analyticsService.logEvent('calendar_print', { year: this.selectedYear });
    window.open(this.calendarUrl);
    this.dialogRef.close();
  }
}