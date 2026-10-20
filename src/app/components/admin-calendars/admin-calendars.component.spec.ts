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

  it('reports an invalid year in a role="alert" region', () => {
    component.isAdding = true;
    component.formData = { year: '26', url: 'https://example.test/x.pdf' };

    component.onSave();
    fixture.detectChanges();

    expect(component.formError).toContain('4-digit');
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('4-digit');
  });

  it('paginates the year list at 10', () => {
    const calendars = Array.from({ length: 12 }, (_, i) => calendar(String(2000 + i)));
    fixture.detectChanges();
    calendars$.next(calendars);

    expect(component.pageData.items.length).toBe(10);
    expect(component.pageData.pageCount).toBe(2);

    component.goToPage(2);
    expect(component.pageData.items.length).toBe(2);
  });
});
