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
  alternateContact?: string;
}

describe('AdminRecoveryComponent', () => {
  let fixture: ComponentFixture<AdminRecoveryComponent>;
  let component: AdminRecoveryComponent;
  let requestsStream: Observable<RecoveryRequest[]>;
  let recipientsStream: Observable<unknown>;
  let auditStream: Observable<any[]>;
  let accountsStream: Observable<any[]>;
  let alertsStream: Observable<any[]>;
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
    auditStream = of([]);
    accountsStream = of([]);
    alertsStream = of([]);
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));

    rtdb = {
      list: (path: string) => ({
        valueChanges: () => {
          if (path === 'recoveryRequests') return requestsStream;
          if (path === 'recoveryAudit') return auditStream;
          if (path === 'users') return accountsStream;
          if (path === 'adminAlerts') return alertsStream;
          return of([]);
        },
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

    expect(lastConfirm?.destructive).toBeFalsy();
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

  it('asks before generating a reset link and names the account', async () => {
    fixture.detectChanges();
    component.reasons[request.id] = 'locked out';
    confirmSpy.and.returnValue(Promise.resolve(false));

    await component.generate(request);

    expect(confirmSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: jasmine.stringMatching('locked-out@example.test') }),
    );
    expect(cloudFunctions.adminGenerateResetLink).not.toHaveBeenCalled();

    confirmSpy.and.returnValue(Promise.resolve(true));
    cloudFunctions.adminGenerateResetLink.and.returnValue(
      Promise.resolve({ data: { link: 'https://example.test/reset', emailed: false } }),
    );
    await component.generate(request);

    expect(cloudFunctions.adminGenerateResetLink).toHaveBeenCalledWith({
      requestId: request.id,
      email: request.email,
      reason: 'locked out',
    });
  });

  it('emails the alternate contact only when the checkbox is checked', async () => {
    const withAlternate: RecoveryRequest = {
      ...request,
      alternateContact: 'alt@example.test',
    };
    requestsStream = of([withAlternate]);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="admin-recovery-email-alternate"]')).toBeTruthy();
    component.reasons[withAlternate.id] = 'locked out';
    confirmSpy.and.returnValue(Promise.resolve(true));
    cloudFunctions.adminGenerateResetLink.and.returnValue(
      Promise.resolve({ data: { link: 'https://example.test/reset', emailed: false } }),
    );

    await component.generate(withAlternate);
    expect(cloudFunctions.adminGenerateResetLink).toHaveBeenCalledWith({
      requestId: withAlternate.id,
      email: withAlternate.email,
      reason: 'locked out',
    });

    component.emailAlternate[withAlternate.id] = true;
    await component.generate(withAlternate);
    expect(cloudFunctions.adminGenerateResetLink).toHaveBeenCalledWith({
      requestId: withAlternate.id,
      email: withAlternate.email,
      reason: 'locked out',
      emailAlternateContact: true,
    });
  });

  it('shows the email-alternate checkbox only when an alternate contact exists', () => {
    requestsStream = of([request]);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="admin-recovery-email-alternate"]')).toBeNull();
  });

  it('shows a retryable error instead of empty when secondary streams fail', () => {
    auditStream = throwError(() => new Error('offline'));
    accountsStream = throwError(() => new Error('offline'));
    alertsStream = throwError(() => new Error('offline'));
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.auditLoadError).toBeTruthy();
    expect(component.accountsLoadError).toBeTruthy();
    expect(component.alertsLoadError).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('app-load-error').length).toBe(3);
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

  it('paginates the recipient list with a card footer', () => {
    const many = Array.from({ length: 12 }, (_, i) => `person${i}@example.test`);
    recipientsStream = of(many);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.recipients.length).toBe(12);
    expect(fixture.nativeElement.querySelectorAll('.recipient-row').length).toBe(10);
    expect(fixture.nativeElement.querySelector('.admin-pagination').textContent).toContain('Showing 1-10 of 12');

    component.nextRecipientsPage();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.recipient-row').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.admin-pagination').textContent).toContain('Showing 11-12 of 12');
  });

  it('paginates requests and audit rows with the shared footer', () => {
    const requests = Array.from({ length: 12 }, (_, i) => ({
      ...request,
      id: `request-${i}`,
      createdAt: Date.now() - i,
    }));
    const audits = Array.from({ length: 12 }, (_, i) => ({
      action: 'generate_reset_link',
      actorEmail: 'admin@example.test',
      createdAt: Date.now() - i,
    }));
    requestsStream = of(requests);
    auditStream = of(audits);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.recovery-row').length).toBe(10);
    expect(fixture.nativeElement.querySelectorAll('.audit-row').length).toBe(10);
    expect(fixture.nativeElement.querySelector('[data-testid="admin-recovery-list"] .admin-pagination').textContent)
      .toContain('Showing 1-10 of 12');

    component.nextRequestsPage();
    component.nextAuditPage();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.recovery-row').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.audit-row').length).toBe(2);
  });

  it('marks Reason as required and explains the disabled Generate button', () => {
    requestsStream = of([request]);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const reason = fixture.nativeElement.querySelector('[data-testid="admin-recovery-reason"]') as HTMLInputElement;
    expect(reason.required).toBe(true);
    expect(fixture.nativeElement.querySelector('.reason-hint').textContent)
      .toContain('Enter a reason');

    component.reasons[request.id] = 'locked out';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reason-hint')).toBeNull();
  });

  it('names each request control with the requester', () => {
    const withAlternate: RecoveryRequest = { ...request, alternateContact: 'alt@example.test' };
    requestsStream = of([withAlternate]);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    fixture.detectChanges();

    const name = (testId: string): string =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`).getAttribute('aria-label');

    expect(fixture.nativeElement.querySelector('[data-testid="admin-recovery-reason"]').getAttribute('aria-label'))
      .toBe('Reason for locked-out@example.test');
    expect(name('admin-recovery-generate')).toBe('Generate reset link for locked-out@example.test');
    expect(name('admin-recovery-close')).toBe('Mark closed for locked-out@example.test');
    expect(name('admin-recovery-email-alternate'))
      .toBe('Email reset link to alt@example.test for locked-out@example.test');
  });

  it('shows the expiry derived from the mint audit entry, else the approximate lifetime', () => {
    const mintedAt = Date.now() - 60 * 1000;

    expect(component.expiryLabel('request-1')).toBe('Expires about an hour after generation');

    component.audit = [{ action: 'generate_reset_link', requestId: 'request-1', createdAt: mintedAt }];

    expect(component.expiryLabel('request-1')).toBe(`Expires ${formatAbsoluteTimestamp(mintedAt + 60 * 60 * 1000)}`);
    expect(component.isLinkExpired('request-1')).toBe(false);
    expect(component.expiryLabel('request-2')).toBe('Expires about an hour after generation');
  });

  it('marks a link expired an hour after the mint', () => {
    const mintedAt = Date.now() - 2 * 60 * 60 * 1000;
    component.now = Date.now();
    component.audit = [{ action: 'generate_reset_link', requestId: 'request-1', createdAt: mintedAt }];

    expect(component.isLinkExpired('request-1')).toBe(true);
    expect(component.expiryLabel('request-1')).toBe('Expired - generate a new link');
  });

  it('shows the no-results empty state and keeps the add form when no recipients exist', () => {
    recipientsStream = of([]);
    fixture = TestBed.createComponent(AdminRecoveryComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="admin-recipients"] app-no-results-message')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="admin-recipient-email"]')).toBeTruthy();
  });
});
