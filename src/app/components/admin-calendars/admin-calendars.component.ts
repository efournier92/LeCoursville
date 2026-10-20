import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Calendar } from 'src/app/models/calendar';
import { Page, paginate } from 'src/app/admin/pagination';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { RtdbService } from 'src/app/services/rtdb.service';

@Component({
    selector: 'app-admin-calendars',
    templateUrl: './admin-calendars.component.html',
    styleUrls: ['./admin-calendars.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminCalendarsComponent implements OnInit, OnDestroy {
  calendars: Calendar[] = [];
  editingCalendar: Calendar | null = null;
  isAdding = false;
  formData = { year: '', url: '' };
  formError = '';
  loading = true;
  loadError = '';
  page = 1;

  private calendarsSub?: Subscription;

  constructor(
    private rtdb: RtdbService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadCalendars();
  }

  ngOnDestroy(): void {
    this.calendarsSub?.unsubscribe();
  }

  get pageData(): Page<Calendar> {
    return paginate(this.calendars, this.page);
  }

  loadCalendars(): void {
    this.loading = true;
    this.loadError = '';
    this.calendarsSub?.unsubscribe();
    this.calendarsSub = this.rtdb.list<Calendar>('calendars').valueChanges().subscribe({
      next: calendars => {
        this.calendars = [...calendars].sort((a, b) => parseInt(a.year) - parseInt(b.year));
        this.page = paginate(this.calendars, this.page).page;
        this.loading = false;
      },
      error: () => {
        this.loadError = 'Could not load calendars.';
        this.loading = false;
      },
    });
  }

  goToPage(page: number): void {
    this.page = page;
  }

  onAdd(): void {
    this.isAdding = true;
    this.editingCalendar = null;
    this.formData = { year: '', url: '' };
    this.formError = '';
  }

  onEdit(calendar: Calendar): void {
    this.editingCalendar = calendar;
    this.isAdding = false;
    this.formData = { year: calendar.year, url: calendar.url };
    this.formError = '';
  }

  async onDelete(calendar: Calendar): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete calendar?',
      message: `Delete the ${calendar.year} calendar PDF mapping? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    await this.rtdb.object(`/calendars/${calendar.id}`).remove();
  }

  onSave(): void {
    const year = this.formData.year.trim();
    const url = this.formData.url.trim();

    if (!year) {
      this.formError = 'Year is required';
      return;
    }
    if (!/^\d{4}$/.test(year)) {
      this.formError = 'Year must be a 4-digit number (e.g., 2026)';
      return;
    }
    if (!url) {
      this.formError = 'URL is required';
      return;
    }

    this.formError = '';

    if (this.isAdding) {
      const id = `cal-${year}`;
      const calendar: Calendar = { id, year, url, path: '' };
      this.rtdb.object(`/calendars/${id}`).set(calendar).then(() => this.onCancel());
    } else if (this.editingCalendar) {
      this.rtdb.object(`/calendars/${this.editingCalendar.id}`).update({ year, url }).then(() => this.onCancel());
    }
  }

  onCancel(): void {
    this.isAdding = false;
    this.editingCalendar = null;
    this.formData = { year: '', url: '' };
    this.formError = '';
  }
}
