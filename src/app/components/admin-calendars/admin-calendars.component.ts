import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Calendar } from 'src/app/models/calendar';
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
  @ViewChild('yearInput') yearInput?: ElementRef<HTMLInputElement>;

  calendars: Calendar[] = [];
  editingCalendar: Calendar | null = null;
  isAdding = false;
  formData = { year: '', url: '' };
  formError = '';
  actionError = '';
  loading = true;
  loadError = '';

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

  loadCalendars(): void {
    this.loading = true;
    this.loadError = '';
    this.calendarsSub?.unsubscribe();
    this.calendarsSub = this.rtdb.list<Calendar>('calendars').valueChanges().subscribe({
      next: calendars => {
        this.calendars = [...calendars].sort((a, b) => parseInt(a.year) - parseInt(b.year));
        this.loading = false;
      },
      error: () => {
        this.loadError = 'Could not load calendars.';
        this.loading = false;
      },
    });
  }

  onAdd(): void {
    this.isAdding = true;
    this.editingCalendar = null;
    this.formData = { year: '', url: '' };
    this.formError = '';
    this.focusFormStart();
  }

  onEdit(calendar: Calendar): void {
    this.editingCalendar = calendar;
    this.isAdding = false;
    this.formData = { year: calendar.year, url: calendar.url };
    this.formError = '';
    this.focusFormStart();
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
    this.actionError = '';
    try {
      await this.rtdb.object(`/calendars/${calendar.id}`).remove();
    } catch (error) {
      this.actionError = this.writeFailure('delete the calendar', error);
    }
  }

  async onSave(): Promise<void> {
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
    this.actionError = '';

    if (this.isAdding && this.calendars.some(calendar => calendar.year === year)) {
      const replace = await this.confirmDialog.confirm({
        title: 'Replace calendar?',
        message: `A calendar already exists for ${year}. Replace its PDF mapping?`,
        confirmLabel: 'Replace',
        destructive: true,
      });
      if (!replace) {
        return;
      }
    }

    try {
      if (this.isAdding) {
        const id = `cal-${year}`;
        const calendar: Calendar = { id, year, url, path: '' };
        await this.rtdb.object(`/calendars/${id}`).set(calendar);
        this.onCancel();
      } else if (this.editingCalendar) {
        await this.rtdb.object(`/calendars/${this.editingCalendar.id}`).update({ year, url });
        this.onCancel();
      }
    } catch (error) {
      this.actionError = this.writeFailure('save the calendar', error);
    }
  }

  onCancel(): void {
    this.isAdding = false;
    this.editingCalendar = null;
    this.formData = { year: '', url: '' };
    this.formError = '';
  }

  private focusFormStart(): void {
    // The Add button is removed when the form opens, so focus must land on the
    // first field instead of being lost; the timeout waits for the form view.
    setTimeout(() => {
      const field = this.yearInput?.nativeElement;
      if (!field) { return; }
      field.scrollIntoView({ block: 'center' });
      field.focus();
    });
  }

  private writeFailure(action: string, error: unknown): string {
    const message = (error as Error)?.message || 'Unknown error';
    return `Could not ${action}: ${message}`;
  }
}
