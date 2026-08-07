import { Component, OnInit } from '@angular/core';
import { Calendar } from 'src/app/models/calendar';
import { RtdbService } from 'src/app/services/rtdb.service';

@Component({
    selector: 'app-admin-calendars',
    templateUrl: './admin-calendars.component.html',
    styleUrls: ['./admin-calendars.component.scss'],
    standalone: false
})
export class AdminCalendarsComponent implements OnInit {
  calendars: Calendar[] = [];
  editingCalendar: Calendar | null = null;
  isAdding = false;
  formData = { year: '', url: '' };
  formError = '';

  constructor(private rtdb: RtdbService) {}

  ngOnInit(): void {
    this.rtdb.list<Calendar>('calendars').valueChanges().subscribe(calendars => {
      this.calendars = calendars.sort((a, b) => parseInt(a.year) - parseInt(b.year));
    });
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

  onDelete(calendar: Calendar): void {
    this.rtdb.object(`/calendars/${calendar.id}`).remove();
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