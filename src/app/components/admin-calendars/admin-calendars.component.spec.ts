import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminCalendarsComponent } from './admin-calendars.component';
import { Calendar } from 'src/app/models/calendar';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { RtdbService } from 'src/app/services/rtdb.service';

describe('AdminCalendarsComponent', () => {
  let fixture: ComponentFixture<AdminCalendarsComponent>;
  let component: AdminCalendarsComponent;
  let calendars$: Subject<Calendar[]>;
  let rtdb: jasmine.SpyObj<RtdbService>;
  let removeSpy: jasmine.Spy;
  let confirmSpy: jasmine.Spy;
  let lastConfirm: { message: string; destructive?: boolean } | undefined;

  const calendar = (year: string): Calendar => ({
    id: `cal-${year}`,
    year,
    url: `https://example.test/${year}.pdf`,
    path: '',
  });

  beforeEach(async () => {
    calendars$ = new Subject<Calendar[]>();
    removeSpy = jasmine.createSpy('remove').and.returnValue(Promise.resolve());
    rtdb = jasmine.createSpyObj('RtdbService', ['list', 'object']);
    rtdb.list.and.returnValue({ valueChanges: () => calendars$ } as any);
    rtdb.object.and.returnValue({
      remove: removeSpy,
      set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
    } as any);
    confirmSpy = jasmine.createSpy('confirm');

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [AdminCalendarsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RtdbService, useValue: rtdb },
        { provide: ConfirmDialogService, useValue: { confirm: confirmSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCalendarsComponent);
    component = fixture.componentInstance;
  });

  it('shows a skeleton while the year list loads', () => {
    fixture.detectChanges();

    expect(component.loading).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="calendars-loading"]')).toBeTruthy();
  });

  it('shows the empty message when the year list is empty', () => {
    fixture.detectChanges();
    calendars$.next([]);
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.querySelector('app-no-results-message')).toBeTruthy();
  });

  it('renders the loaded calendars in a table', () => {
    fixture.detectChanges();
    calendars$.next([calendar('2026'), calendar('2025')]);
    fixture.detectChanges();

    const years = Array.from(
      fixture.nativeElement.querySelectorAll('.calendar-year') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim());
    expect(years).toEqual(['2025', '2026']);
  });

  it('shows a retryable error when the stream fails', () => {
    fixture.detectChanges();
    calendars$.error(new Error('offline'));
    fixture.detectChanges();

    expect(component.loadError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-load-error')).toBeTruthy();
  });

  it('does not delete when the confirmation is cancelled', async () => {
    confirmSpy.and.callFake((data: { message: string; destructive?: boolean }) => {
      lastConfirm = data;
      return Promise.resolve(false);
    });

    await component.onDelete(calendar('2026'));

    expect(lastConfirm?.destructive).toBe(true);
    expect(lastConfirm?.message).toContain('2026');
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('deletes after confirmation', async () => {
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onDelete(calendar('2026'));

    expect(rtdb.object).toHaveBeenCalledWith('/calendars/cal-2026');
    expect(removeSpy).toHaveBeenCalled();
  });

  it('warns before replacing an existing year and writes nothing when cancelled', async () => {
    fixture.detectChanges();
    calendars$.next([calendar('2026')]);
    fixture.detectChanges();
    confirmSpy.and.returnValue(Promise.resolve(false));

    component.onAdd();
    component.formData = { year: '2026', url: 'https://example.test/replacement.pdf' };
    await component.onSave();

    expect(confirmSpy).toHaveBeenCalled();
    expect(rtdb.object).not.toHaveBeenCalled();
    expect(component.isAdding).toBe(true);
  });

  it('replaces an existing year after the warning is confirmed', async () => {
    fixture.detectChanges();
    calendars$.next([calendar('2026')]);
    fixture.detectChanges();
    confirmSpy.and.returnValue(Promise.resolve(true));

    component.onAdd();
    component.formData = { year: '2026', url: 'https://example.test/replacement.pdf' };
    await component.onSave();

    expect((rtdb.object('/calendars/cal-2026') as any).set).toHaveBeenCalled();
  });

  it('renders the URL as a safe new-tab link and names row actions by year', () => {
    fixture.detectChanges();
    calendars$.next([calendar('2026')]);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.calendar-url-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.test/2026.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.calendar-actions button') as NodeListOf<HTMLElement>,
    ).map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(['Edit 2026', 'Delete 2026']);
  });

  it('reports an invalid year in a role="alert" region', () => {
    component.isAdding = true;
    component.formData = { year: '26', url: 'https://example.test/x.pdf' };

    component.onSave();
    fixture.detectChanges();

    expect(component.formError).toContain('4-digit');
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('4-digit');
  });

  it('keeps the form open and shows a role="alert" error when a save fails', async () => {
    const setSpy = (rtdb.object() as any).set as jasmine.Spy;
    setSpy.and.returnValue(Promise.reject(new Error('offline')));
    component.isAdding = true;
    component.formData = { year: '2026', url: 'https://example.test/2026.pdf' };

    await component.onSave();
    fixture.detectChanges();

    expect(component.isAdding).toBe(true);
    expect(component.actionError).toContain('offline');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('offline');
  });

  it('shows a role="alert" error when a delete fails', async () => {
    removeSpy.and.returnValue(Promise.reject(new Error('offline')));
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onDelete(calendar('2026'));
    fixture.detectChanges();

    expect(component.actionError).toContain('offline');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('offline');
  });

  it('renders every year in the bounded list', () => {
    const calendars = Array.from({ length: 12 }, (_, i) => calendar(String(2000 + i)));
    fixture.detectChanges();
    calendars$.next(calendars);
    fixture.detectChanges();

    expect(component.calendars.length).toBe(12);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(12);
  });
});
