import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminRecoveryComponent, formatAbsoluteTimestamp } from './admin-recovery.component';
import { CloudFunctionsService } from 'src/app/services/cloud-functions.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { RtdbService } from 'src/app/services/rtdb.service';

interface RecoveryRequest {
  id: string;
  email: string;
  name?: string;
  status: string;
  createdAt: number;
}

describe('AdminRecoveryComponent', () => {
  let fixture: ComponentFixture<AdminRecoveryComponent>;
  let component: AdminRecoveryComponent;
  let requestsStream: Observable<RecoveryRequest[]>;
  let recipientsStream: Observable<unknown>;
  let rtdb: RtdbService;
  let cloudFunctions: jasmine.SpyObj<CloudFunctionsService>;
  let confirmSpy: jasmine.Spy;
  let lastConfirm: { message: string; destructive?: boolean } | undefined;

  const request: RecoveryRequest = {
    id: 'request-1',
    email: 'locked-out@example.test',
    name: 'Locked Out',
    status: 'open',
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    requestsStream = new Subject<RecoveryRequest[]>();
    recipientsStream = of(['admin@example.test', 'backup@example.test']);
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));

    rtdb = {
      list: (path: string) => ({
        valueChanges: () => (path === 'recoveryRequests' ? requestsStream : of([])),
      }),
      object: (path: string) => ({
        valueChanges: () => (path === 'config/adminAlertRecipients' ? recipientsStream : of(null)),
      }),
    } as unknown as RtdbService;

    cloudFunctions = jasmine.createSpyObj('CloudFunctionsService', [
      'adminGenerateResetLink',
      'updateAlertRecipients',
      'closeRecoveryRequest',
    ]);
    cloudFunctions.updateAlertRecipients.and.returnValue(Promise.resolve());
    cloudFunctions.closeRecoveryRequest.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [AdminRecoveryComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RtdbService, useValue: rtdb },
        { provide: CloudFunctionsService, useValue: cloudFunctions },
        { provide: ConfirmDialogService, useValue: { confirm: confirmSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRecoveryComponent);
    component = fixture.componentInstance;
  });

  it('shows a skeleton while requests load', () => {
    fixture.detectChanges();

    expect(component.requestsLoading).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="admin-recovery-loading"]')).toBeTruthy();
  });

  it('shows the empty message when there are no requests', () => {
    fixture.detectChanges();
    (requestsStream as Subject<RecoveryRequest[]>).next([]);
    fixture.detectChanges();

    expect(component.requestsLoading).toBe(false);
    expect(fixture.nativeElement.querySelector('app-no-results-message')).toBeTruthy();
  });

  it('renders a request row when the stream emits', () => {
    fixture.detectChanges();
    (requestsStream as Subject<RecoveryRequest[]>).next([request]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.recovery-row').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain(request.email);
  });

  it('formats absolute timestamps as YYYY-MM-DD HH:mm', () => {
    const timestamp = new Date(2026, 0, 2, 3, 4, 5).getTime();

    expect(formatAbsoluteTimestamp(timestamp)).toBe('2026-01-02 03:04');
    expect(component.formatTimestamp(timestamp)).toBe('2026-01-02 03:04');
  });

  it('renders an empty string for a missing timestamp', () => {
    expect(formatAbsoluteTimestamp(0)).toBe('');
  });

  it('does not remove a recipient when cancelled', async () => {
    fixture.detectChanges();
    confirmSpy.and.callFake((data: { message: string; destructive?: boolean }) => {
      lastConfirm = data;
      return Promise.resolve(false);
    });

    await component.removeRecipient('backup@example.test');

    expect(lastConfirm?.destructive).toBe(true);
    expect(lastConfirm?.message).toContain('backup@example.test');
    expect(cloudFunctions.updateAlertRecipients).not.toHaveBeenCalled();
  });

  it('removes a recipient after confirmation', async () => {
    fixture.detectChanges();
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.removeRecipient('backup@example.test');

    expect(cloudFunctions.updateAlertRecipients).toHaveBeenCalledWith(['admin@example.test']);
  });

  it('asks before closing a request and closes on confirm', async () => {
    fixture.detectChanges();
    (requestsStream as Subject<RecoveryRequest[]>).next([request]);
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.markClosed(request);

    expect(confirmSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        title: 'Mark Request Closed?',
        confirmLabel: 'Yes',
        destructive: true,
      }),
    );
    expect(cloudFunctions.closeRecoveryRequest).toHaveBeenCalledWith({
      requestId: 'request-1',
      reason: undefined,
    });
  });

  it('does not close when the confirmation is cancelled', async () => {
    fixture.detectChanges();
    confirmSpy.and.returnValue(Promise.resolve(false));

    await component.markClosed(request);

    expect(cloudFunctions.closeRecoveryRequest).not.toHaveBeenCalled();
  });

  it('shows an error state and recovers when retried', () => {
    requestsStream = throwError(() => new Error('offline'));
    fixture.detectChanges();

    expect(component.requestsLoadError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-load-error')).toBeTruthy();

    requestsStream = of([request]);
    component.loadRequests();
    fixture.detectChanges();

    expect(component.requestsLoadError).toBe('');
    expect(fixture.nativeElement.querySelectorAll('.recovery-row').length).toBe(1);
  });

  it('paginates recipients at 10', () => {
    const many = Array.from({ length: 12 }, (_, i) => `person${i}@example.test`);
    recipientsStream = of(many);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.recipientPageData.items.length).toBe(10);
    expect(component.recipientPageData.pageCount).toBe(2);

    component.goToRecipientPage(2);
    expect(component.recipientPageData.items.length).toBe(2);
  });
});
