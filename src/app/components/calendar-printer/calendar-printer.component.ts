import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { map } from 'rxjs/operators';
import { Calendar } from 'src/app/models/calendar';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-calendar-printer',
  templateUrl: './calendar-printer.component.html',
  styleUrls: ['./calendar-printer.component.scss']
})
export class CalendarPrinterComponent implements OnInit {
  availableYears: number[] = [];
  selectedYear: number | null = null;
  calendarUrl: string | null = null;
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<CalendarPrinterComponent>,
    private db: AngularFireDatabase,
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.loadAvailableYears();
    this.analyticsService.logEvent('component_load_calendar_printer', {});
  }

  private loadAvailableYears(): void {
    this.loading = true;
    const thisYear = new Date().getFullYear();
    const maxYears = [thisYear, thisYear + 1, thisYear + 2];

    this.db.list<Calendar>('calendars').valueChanges().subscribe(calendars => {
      const configuredYears = new Set(
        calendars.map(c => parseInt(c.year)).filter(y => !isNaN(y))
      );

      this.availableYears = maxYears.filter(y => configuredYears.has(y));

      if (this.availableYears.length > 0 && !this.selectedYear) {
        this.selectedYear = this.availableYears[0];
        this.loadCalendarUrl();
      }
      this.loading = false;
    });
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    this.calendarUrl = null;
    this.loadCalendarUrl();
  }

  private loadCalendarUrl(): void {
    if (!this.selectedYear) return;
    this.db.object<{ url: string }>(`/calendars/cal-${this.selectedYear}`).valueChanges().pipe(
      map(cal => cal?.url || null)
    ).subscribe(url => {
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