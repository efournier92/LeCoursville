import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CloudFunctionsService } from 'src/app/services/cloud-functions.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { RtdbService } from 'src/app/services/rtdb.service';
import { paginate, Page, pageRange } from 'src/app/admin/pagination';

interface RecoveryRequest {
  id: string;
  email: string;
  name?: string;
  alternateContact?: string | null;
  message?: string | null;
  status: string;
  createdAt: number;
}

interface RecoveryAuditEntry {
  id?: string;
  action: string;
  actorUid?: string;
  actorEmail?: string;
  targetEmail?: string;
  requestId?: string;
  reason?: string;
  createdAt: number;
}

interface AccountUser {
  id: string;
  name?: string;
  email?: string;
  roles?: Record<string, boolean>;
  // RTDB stores the seed's Date as an ISO string but a fresh write as a number.
  dateRegistered?: number | string;
}

interface AdminAlert {
  type: string;
  data?: Record<string, unknown>;
  createdAt?: number;
  createdBy?: string;
}

interface ActivityItem {
  kind: string;
  actor: string;
  createdAt: number;
}

// Actions merged into the Recent Recovery Activity feed.
const ACTIVITY_ACTIONS = [
  'generate_reset_link',
  'close_request',
  'update_recipients',
  // Someone the global cap turned away: the owner wants to see and help them.
  'recovery_attempt_denied',
];
const ALERT_ACTIVITY_TYPES = ['recovery_request', 'rate_limit_breach'];

// Firebase password reset links expire one hour after the mint.
const RESET_LINK_TTL_MS = 60 * 60 * 1000;

/** Absolute timestamps read `YYYY-MM-DD HH:mm` so audit and activity align. */
export function formatAbsoluteTimestamp(createdAt: number): string {
  if (!createdAt) {
    return '';
  }
  const date = new Date(createdAt);
  const pad = (value: number): string => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface GeneratedResult {
  link: string;
  emailed: boolean;
  request: RecoveryRequest;
  mintedAt: number;
}

@Component({
  selector: 'app-admin-recovery',
  templateUrl: './admin-recovery.component.html',
  styleUrls: ['./admin-recovery.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminRecoveryComponent implements OnInit, OnDestroy {
  requests: RecoveryRequest[] = [];
  visibleRequests: RecoveryRequest[] = [];
  reasons: Record<string, string> = {};
  emailAlternate: Record<string, boolean> = {};
  generated: Record<string, GeneratedResult> = {};
  errors: Record<string, string> = {};
  copied: Record<string, boolean> = {};
  copyErrors: Record<string, string> = {};
  generating: Record<string, boolean> = {};
  closing: Record<string, boolean> = {};
  recipients: string[] = [];
  newRecipient = '';
  recipientsBusy = false;
  recipientsError = '';
  audit: RecoveryAuditEntry[] = [];
  accountCreations: AccountUser[] = [];
  alerts: AdminAlert[] = [];
  requestsLoading = true;
  requestsLoadError = '';
  recipientsLoading = true;
  recipientsLoadError = '';
  auditLoadError = '';
  accountsLoadError = '';
  alertsLoadError = '';
  now = Date.now();

  readonly pageSize = 10;
  requestsPage = 1;
  recipientsPage = 1;
  auditPage = 1;

  private requestsSub?: Subscription;
  private recipientsSub?: Subscription;
  private auditSub?: Subscription;
  private accountsSub?: Subscription;
  private alertsSub?: Subscription;
  private clockTimer?: ReturnType<typeof setInterval>;

  constructor(
    private rtdb: RtdbService,
    private cloudFunctions: CloudFunctionsService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadRequests();
    this.loadRecipients();
    this.loadAudit();
    this.loadAccounts();
    this.loadAlerts();
    this.clockTimer = setInterval(() => this.now = Date.now(), 30000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
    this.requestsSub?.unsubscribe();
    this.recipientsSub?.unsubscribe();
    this.auditSub?.unsubscribe();
    this.accountsSub?.unsubscribe();
    this.alertsSub?.unsubscribe();
  }

  loadRequests(): void {
    this.requestsLoading = true;
    this.requestsLoadError = '';
    this.requestsSub?.unsubscribe();
    this.requestsSub = this.rtdb.list<RecoveryRequest>('recoveryRequests').valueChanges().subscribe({
      next: requests => {
        this.requests = [...requests].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        this.rebuildVisibleRequests();
        this.requestsLoading = false;
      },
      error: () => {
        this.requestsLoadError = 'Could not load recovery requests.';
        this.requestsLoading = false;
      },
    });
  }

  loadRecipients(): void {
    this.recipientsLoading = true;
    this.recipientsLoadError = '';
    this.recipientsSub?.unsubscribe();
    this.recipientsSub = this.rtdb.object<unknown>('config/adminAlertRecipients')
      .valueChanges()
      .subscribe({
        next: value => {
          this.recipients = this.normalizeRecipients(value);
          this.recipientsLoading = false;
        },
        error: () => {
          this.recipientsLoadError = 'Could not load alert recipients.';
          this.recipientsLoading = false;
        },
      });
  }

  loadAudit(): void {
    this.auditLoadError = '';
    this.auditSub?.unsubscribe();
    this.auditSub = this.rtdb.list<RecoveryAuditEntry>('recoveryAudit').valueChanges().subscribe({
      next: entries => {
        this.audit = [...entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      },
      error: () => {
        this.auditLoadError = 'Could not load the audit trail.';
      },
    });
  }

  loadAccounts(): void {
    this.accountsLoadError = '';
    this.accountsSub?.unsubscribe();
    this.accountsSub = this.rtdb.list<AccountUser>('users').valueChanges().subscribe({
      next: users => {
        this.accountCreations = [...users]
          .sort((a, b) => this.registeredAt(b) - this.registeredAt(a))
          .slice(0, 20);
      },
      error: () => {
        this.accountsLoadError = 'Could not load recent account creations.';
      },
    });
  }

  loadAlerts(): void {
    this.alertsLoadError = '';
    this.alertsSub?.unsubscribe();
    this.alertsSub = this.rtdb.list<AdminAlert>('adminAlerts').valueChanges().subscribe({
      next: alerts => {
        this.alerts = alerts;
      },
      error: () => {
        this.alertsLoadError = 'Could not load recent recovery activity.';
      },
    });
  }

  get activityLoadError(): string {
    return this.alertsLoadError || this.auditLoadError;
  }

  retryActivity(): void {
    this.loadAudit();
    this.loadAlerts();
  }

  /**
   * Every stored request stays visible regardless of status (C-04: an abandoned
   * pending row must stay actable). Generated rows are merged in only if the
   * live list does not already carry that id. Rebuilt on data change, not per
   * change-detection pass.
   */
  private rebuildVisibleRequests(): void {
    const knownIds = new Set(this.requests.map(request => request.id));
    const generatedOnly = Object.values(this.generated)
      .map(result => result.request)
      .filter(request => !knownIds.has(request.id));
    this.visibleRequests = [...this.requests, ...generatedOnly]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  get requestPageData(): Page<RecoveryRequest> {
    return paginate(this.visibleRequests, this.requestsPage, this.pageSize);
  }

  get requestShowingRange(): string {
    return pageRange(this.requestPageData);
  }

  get recipientPageData(): Page<string> {
    return paginate(this.recipients, this.recipientsPage, this.pageSize);
  }

  get recipientShowingRange(): string {
    return pageRange(this.recipientPageData);
  }

  get auditPageData(): Page<RecoveryAuditEntry> {
    return paginate(this.audit, this.auditPage, this.pageSize);
  }

  get auditShowingRange(): string {
    return pageRange(this.auditPageData);
  }

  previousRequestsPage(): void {
    this.requestsPage = Math.max(1, this.requestPageData.page - 1);
  }

  nextRequestsPage(): void {
    this.requestsPage = Math.min(this.requestPageData.pageCount, this.requestPageData.page + 1);
  }

  previousRecipientsPage(): void {
    this.recipientsPage = Math.max(1, this.recipientPageData.page - 1);
  }

  nextRecipientsPage(): void {
    this.recipientsPage = Math.min(this.recipientPageData.pageCount, this.recipientPageData.page + 1);
  }

  previousAuditPage(): void {
    this.auditPage = Math.max(1, this.auditPageData.page - 1);
  }

  nextAuditPage(): void {
    this.auditPage = Math.min(this.auditPageData.pageCount, this.auditPageData.page + 1);
  }

  /** Recent alerts and privileged audit actions, newest first, capped for a fast scan. */
  get activity(): ActivityItem[] {
    const fromAlerts = this.alerts
      .filter(alert => ALERT_ACTIVITY_TYPES.includes(alert.type))
      .map(alert => ({
        kind: alert.type,
        actor: this.alertActor(alert),
        createdAt: alert.createdAt || 0,
      }));
    const fromAudit = this.audit
      .filter(entry => ACTIVITY_ACTIONS.includes(entry.action))
      .map(entry => ({
        kind: entry.action,
        actor: this.auditActor(entry),
        createdAt: entry.createdAt || 0,
      }));
    return [...fromAlerts, ...fromAudit]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  }

  /** True only roles, as the account-created notifier reports them. */
  rolesLabel(user: AccountUser): string {
    const roles = user.roles || {};
    return Object.keys(roles).filter(role => roles[role] === true).join(', ');
  }

  accountCreatedAt(user: AccountUser): string {
    return formatAbsoluteTimestamp(this.registeredAt(user));
  }

  canGenerate(request: RecoveryRequest): boolean {
    return request.status === 'open' && (this.reasons[request.id] || '').trim().length > 0;
  }

  reasonHint(request: RecoveryRequest): string {
    return request.status === 'open'
      ? 'Enter a reason to generate a reset link.'
      : 'Only open requests can generate a reset link.';
  }

  /** Resolved and closed rows are terminal; open and stale pending rows stay closable. */
  // minimalist: a fresh pending row is enabled too and the callable rejects it;
  // upgrade by mirroring the function's RECOVERY_LOCK_TTL_MS once it is shared.
  canClose(request: RecoveryRequest): boolean {
    return request.status !== 'resolved' && request.status !== 'closed';
  }

  async generate(request: RecoveryRequest): Promise<void> {
    if (this.generating[request.id]) {
      return;
    }
    const reason = (this.reasons[request.id] || '').trim();
    if (!reason) {
      return;
    }
    const account = request.name && request.name !== request.email
      ? `${request.name} (${request.email})`
      : request.email;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Generate reset link?',
      message: `Generate a password reset link for ${account}?`,
      confirmLabel: 'Generate',
    });
    if (!confirmed) {
      return;
    }
    this.generating[request.id] = true;
    this.errors[request.id] = '';
    try {
      const emailAlternateContact = this.emailAlternate[request.id] === true;
      const { data } = await this.cloudFunctions.adminGenerateResetLink({
        requestId: request.id,
        email: request.email,
        reason,
        ...(emailAlternateContact ? { emailAlternateContact: true } : {}),
      }) as { data: { link: string; emailed: boolean } };
      this.generated[request.id] = {
        link: data.link,
        emailed: data.emailed,
        request,
        mintedAt: Date.now(),
      };
      this.rebuildVisibleRequests();
    } catch (error) {
      this.errors[request.id] = (error as Error)?.message || 'Failed to generate reset link.';
    } finally {
      this.generating[request.id] = false;
    }
  }

  async markClosed(request: RecoveryRequest): Promise<void> {
    if (this.closing[request.id]) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Mark Request Closed?',
      message: `Close the recovery request for ${request.email} without generating a reset link?`,
      confirmLabel: 'Yes',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (confirmed) {
      await this.confirmClose(request);
    }
  }

  private async confirmClose(request: RecoveryRequest): Promise<void> {
    this.closing[request.id] = true;
    this.errors[request.id] = '';
    try {
      const reason = (this.reasons[request.id] || '').trim();
      await this.cloudFunctions.closeRecoveryRequest({
        requestId: request.id,
        reason: reason || undefined,
      });
    } catch (error) {
      this.errors[request.id] = (error as Error)?.message || 'Failed to close request.';
    } finally {
      this.closing[request.id] = false;
    }
  }

  async copyLink(link: string, requestId: string): Promise<void> {
    this.copyErrors[requestId] = '';
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          this.copyFallback(link);
        }
      } else {
        this.copyFallback(link);
      }
      this.copied[requestId] = true;
      setTimeout(() => {
        this.copied[requestId] = false;
      }, 2000);
    } catch {
      this.copyErrors[requestId] = 'Could not copy the link. Select it and copy manually.';
    }
  }

  addRecipient(): void {
    const email = this.newRecipient.trim().toLowerCase();
    if (!this.isValidEmail(email)) {
      this.recipientsError = 'Enter a valid email address.';
      return;
    }
    if (this.recipients.includes(email)) {
      this.newRecipient = '';
      return;
    }
    this.saveRecipients([...this.recipients, email]);
  }

  async removeRecipient(email: string): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove recipient?',
      message: `Remove ${email} from the recovery alert recipients? They will stop receiving recovery alerts.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    await this.saveRecipients(this.recipients.filter(recipient => recipient !== email));
  }

  formatTimestamp(createdAt: number): string {
    return formatAbsoluteTimestamp(createdAt);
  }

  /**
   * The callable does not return a mint timestamp, so the mint audit entry is
   * the only trustworthy one; a locally minted link covers the gap until it
   * lands. Without either, state the approximate lifetime rather than derive
   * an expiry that could drift.
   */
  expiryLabel(requestId: string): string {
    const mint = this.resetMintAt(requestId);
    if (!mint) {
      return 'Expires about an hour after generation';
    }
    return this.isLinkExpired(requestId)
      ? 'Expired - generate a new link'
      : `Expires ${formatAbsoluteTimestamp(mint + RESET_LINK_TTL_MS)}`;
  }

  isLinkExpired(requestId: string): boolean {
    const mint = this.resetMintAt(requestId);
    return mint > 0 && this.now - mint >= RESET_LINK_TTL_MS;
  }

  private resetMintAt(requestId: string): number {
    const audited = this.audit
      .filter(entry => entry.action === 'generate_reset_link' && entry.requestId === requestId)
      .reduce((latest, entry) => Math.max(latest, entry.createdAt || 0), 0);
    return audited || this.generated[requestId]?.mintedAt || 0;
  }

  auditActor(entry: RecoveryAuditEntry): string {
    // A denied recovery attempt has no authenticated actor, so fall back to the
    // address the locked-out person tried.
    return entry.actorEmail || entry.actorUid || entry.targetEmail || 'Unknown';
  }

  private async saveRecipients(emails: string[]): Promise<void> {
    this.recipientsBusy = true;
    this.recipientsError = '';
    try {
      await this.cloudFunctions.updateAlertRecipients(emails);
      this.recipients = emails;
      this.newRecipient = '';
    } catch (error) {
      this.recipientsError = (error as Error)?.message || 'Failed to update recipients.';
    } finally {
      this.recipientsBusy = false;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Mirrors the function's normalization: array, index object, or legacy address->bool map. */
  private normalizeRecipients(value: unknown): string[] {
    const entries: Array<[string | null, unknown]> = Array.isArray(value)
      ? value.map(entry => [null, entry] as [null, unknown])
      : value && typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>)
        : [];
    const addresses = entries.map(([key, entry]) =>
      typeof entry === 'string' ? entry : entry === true && key ? key : '');
    return [...new Set(addresses.map(entry => entry.trim()).filter(Boolean))];
  }

  private registeredAt(user: AccountUser): number {
    const value = user.dateRegistered;
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private alertActor(alert: AdminAlert): string {
    const data = alert.data || {};
    return String(
      data['email'] || data['actorEmail'] || data['emailHash'] || data['actorHash'] || alert.createdBy || 'system',
    );
  }

  private copyFallback(link: string): void {
    const textarea = document.createElement('textarea');
    let copied = false;
    try {
      textarea.value = link;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand('copy');
    } finally {
      textarea.remove();
    }
    if (!copied) {
      throw new Error('Clipboard copy is unavailable.');
    }
  }
}
