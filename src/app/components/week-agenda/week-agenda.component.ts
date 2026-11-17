import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  AfterViewInit, OnChanges, SimpleChanges, ViewChild, ElementRef,
} from '@angular/core';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { AppSettings } from 'src/app/config/app-settings';

export interface AgendaDay {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  events: RecurringEvent[];
}

@Component({
    selector: 'app-week-agenda',
    templateUrl: './week-agenda.component.html',
    styleUrls: ['./week-agenda.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class WeekAgendaComponent implements AfterViewInit, OnChanges {
  @Input() events: RecurringEvent[] = [];
  @Input() anchorDate: Date;
  @Input() selectedDay: Date;
  @Input() variant: 'preview' | 'full' = 'full';
  @Input() hideTitle = false;

  @Output() daySelect = new EventEmitter<Date>();
  @Output() personClick = new EventEmitter<string>();
  @Output() spouseClick = new EventEmitter<string>();
  @Output() fullAgenda = new EventEmitter<void>();

  @ViewChild('scroll') scroll?: ElementRef<HTMLElement>;

  days: AgendaDay[] = [];
  windowAnchor: Date;
  start: Date;
  count = 21;

  private loadingEarlier = false;
  private loadingLater = false;
  private previousScrollHeight: number | null = null;

  get isPreview(): boolean {
    return this.variant === 'preview';
  }

  get rangeEnd(): Date {
    return this.addDays(this.windowAnchor, this.isPreview ? 2 : 6);
  }

  get anchorIsToday(): boolean {
    return this.sameDay(this.windowAnchor, new Date());
  }

  get showTodayButton(): boolean {
    return !!this.windowAnchor && (!this.anchorIsToday || this.count > this.defaultCount());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.anchorDate) return;

    if (changes['anchorDate'] || changes['variant']) {
      this.windowAnchor = this.midnight(this.anchorDate);
      this.resetWindow();
      if (!this.isPreview) {
        setTimeout(() => this.scrollToAnchor());
      }
    } else if (changes['events']) {
      this.buildDays();
    }

    if (changes['selectedDay'] && !changes['selectedDay'].firstChange) {
      this.buildDays();
      if (!this.isPreview) {
        setTimeout(() => this.scrollSelectedIntoView());
      }
    }
  }

  ngAfterViewInit(): void {
    if (!this.isPreview) {
      setTimeout(() => this.scrollToAnchor());
    }
  }

  onScroll(): void {
    if (this.isPreview) return;
    const el = this.scroll?.nativeElement;
    if (!el) return;

    if (el.scrollTop < 120 && !this.loadingEarlier) {
      this.loadingEarlier = true;
      this.previousScrollHeight = el.scrollHeight;
      this.loadEarlier();
    }
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 120 && !this.loadingLater) {
      this.loadingLater = true;
      this.loadLater();
    }
  }

  loadEarlier(): void {
    const el = this.scroll?.nativeElement;
    const previousHeight = this.previousScrollHeight ?? el?.scrollHeight ?? 0;
    this.start = this.addDays(this.start, -7);
    this.count += 7;
    this.buildDays();
    if (el && previousHeight) {
      setTimeout(() => {
        el.scrollTop += el.scrollHeight - previousHeight;
        this.loadingEarlier = false;
      });
    } else {
      this.loadingEarlier = false;
    }
  }

  loadLater(): void {
    this.count += 7;
    this.buildDays();
    this.loadingLater = false;
  }

  goToToday(): void {
    const today = this.midnight(new Date());
    this.windowAnchor = today;
    this.start = this.isPreview ? today : this.addDays(today, -7);
    this.count = this.defaultCount();
    this.buildDays();
    this.daySelect.emit(today);
    if (!this.isPreview) {
      setTimeout(() => this.scrollToAnchor());
    }
  }

  ariaLabel(day: AgendaDay): string {
    const prefix = day.isToday ? 'Today, ' : '';
    const date = day.date.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const count = day.events.length;
    if (!count) return `${prefix}${date}, no events`;
    const types = [...new Set(day.events.map(event => this.typeLabel(event.type)))];
    return `${prefix}${date}, ${count} ${count === 1 ? 'event' : 'events'}: ${types.join(', ')}`;
  }

  private resetWindow(): void {
    this.start = this.isPreview ? this.windowAnchor : this.addDays(this.windowAnchor, -7);
    this.count = this.defaultCount();
    this.buildDays();
  }

  private defaultCount(): number {
    return this.isPreview ? 3 : 21;
  }

  private buildDays(): void {
    if (!this.start) return;
    const days: AgendaDay[] = [];
    for (let i = 0; i < this.count; i++) {
      const date = this.addDays(this.start, i);
      days.push({
        date,
        isToday: this.sameDay(date, new Date()),
        isSelected: this.sameDay(date, this.selectedDay),
        events: (this.events || []).filter(event =>
          this.isDisplayable(event) && this.eventMatchesDay(event, date)
        ),
      });
    }
    this.days = days;
  }

  // minimalist: person events match month/day so the rolling window crosses a
  // year boundary, but holidays only exist for the viewed year so they must
  // match the day's year too or they would repeat in the adjacent year.
  private eventMatchesDay(event: RecurringEvent, day: Date): boolean {
    if (!event.start) return false;
    if (event.type === 'holiday') {
      return this.sameDay(event.start, day);
    }
    return event.start.getMonth() === day.getMonth()
      && event.start.getDate() === day.getDate();
  }

  private isDisplayable(event: RecurringEvent): boolean {
    return !(AppSettings.calendar.excludeNonLivingAnniversaries
      && event.type === 'anniversary'
      && event.isLiving === false);
  }

  private scrollToAnchor(): void {
    const el = this.scroll?.nativeElement;
    if (!el) return;
    const target = this.findItem(this.windowAnchor);
    if (target) el.scrollTop = target.offsetTop;
  }

  private scrollSelectedIntoView(): void {
    const el = this.scroll?.nativeElement;
    if (!el) return;
    const target = this.findItem(this.selectedDay);
    if (!target) return;
    const top = target.offsetTop;
    const bottom = top + target.offsetHeight;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
  }

  private findItem(date: Date): HTMLElement | null {
    if (!date) return null;
    const key = this.midnight(date).getTime();
    return this.scroll?.nativeElement.querySelector<HTMLElement>(`[data-date="${key}"]`) ?? null;
  }

  private typeLabel(type: string): string {
    switch (type) {
      case 'birth': return 'birthday';
      case 'anniversary': return 'anniversary';
      case 'holiday': return 'holiday';
      default: return 'event';
    }
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private midnight(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private sameDay(a: Date, b: Date): boolean {
    return !!a && !!b
      && a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }
}
