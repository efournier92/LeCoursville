import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Page, paginate } from 'src/app/admin/pagination';
import { CloudFunctionsService } from 'src/app/services/cloud-functions.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { RtdbService } from 'src/app/services/rtdb.service';

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

interface GeneratedResult {
  link: string;
  emailed: boolean;
  request: RecoveryRequest;
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
  reasons: Record<string, string> = {};
  generated: Record<string, GeneratedResult> = {};
  errors: Record<string, string> = {};
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
  recipientPage = 1;

  private subscriptions: Subscription[] = [];
  private requestsSub?: Subscription;
  private recipientsSub?: Subscription;

  constructor(
    private rtdb: RtdbService,
    private cloudFunctions: CloudFunctionsService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadRequests();
    this.loadRecipients();
    this.subscriptions.push(
      this.rtdb.list<RecoveryAuditEntry>('recoveryAudit').valueChanges().subscribe(entries => {
        this.audit = entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }),
    );
    this.subscriptions.push(
      this.rtdb.list<AccountUser>('users').valueChanges().subscribe(users => {
        this.accountCreations = [...users]
          .sort((a, b) => this.registeredAt(b) - this.registeredAt(a))
          .slice(0, 20);
      }),
    );
    this.subscriptions.push(
      this.rtdb.list<AdminAlert>('adminAlerts').valueChanges().subscribe(alerts => {
        this.alerts = alerts;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.requestsSub?.unsubscribe();
    this.recipientsSub?.unsubscribe();
  }

  get recipientPageData(): Page<string> {
    return paginate(this.recipients, this.recipientPage);
  }

  loadRequests(): void {
    this.requestsLoading = true;
    this.requestsLoadError = '';
    this.requestsSub?.unsubscribe();
    this.requestsSub = this.rtdb.list<RecoveryRequest>('recoveryRequests').valueChanges().subscribe({
      next: requests => {
        this.requests = [...requests].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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

  goToRecipientPage(page: number): void {
    this.recipientPage = page;
  }

  /**
   * Every stored request stays visible regardless of status (C-04: an abandoned
   * pending row must stay actable). Generated rows are merged in only if the
   * live list does not already carry that id.
   */
  get visibleRequests(): RecoveryRequest[] {
    const knownIds = new Set(this.requests.map(request => request.id));
    const generatedOnly = Object.values(this.generated)
      .map(result => result.request)
      .filter(request => !knownIds.has(request.id));
    return [...this.requests, ...generatedOnly]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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

  accountAge(user: AccountUser): string {
    return this.age(this.registeredAt(user));
  }

  canGenerate(request: RecoveryRequest): boolean {
    return request.status === 'open' && (this.reasons[request.id] || '').trim().length > 0;
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
    this.generating[request.id] = true;
    this.errors[request.id] = '';
    try {
      const { data } = await this.cloudFunctions.adminGenerateResetLink({
        requestId: request.id,
        email: request.email,
        reason,
      }) as { data: { link: string; emailed: boolean } };
      this.generated[request.id] = { link: data.link, emailed: data.emailed, request };
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

  copyLink(link: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).catch(() => this.copyFallback(link));
      return;
    }
    this.copyFallback(link);
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

  age(createdAt: number): string {
    if (!createdAt) {
      return '';
    }
    const minutes = Math.floor((Date.now() - createdAt) / 60000);
    if (minutes < 1) {
      return 'just now';
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
  }

  formatTimestamp(createdAt: number): string {
    return createdAt ? new Date(createdAt).toLocaleString() : '';
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
    try {
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      // Clipboard unavailable; the link stays visible for manual copy.
    }
  }
}
