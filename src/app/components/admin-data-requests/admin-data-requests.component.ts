import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DataRequest, DataRequestStatus, REDACTED_CONTACT } from 'src/app/models/data-request';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { DataRequestsService } from 'src/app/services/data-requests.service';

@Component({
  selector: 'app-admin-data-requests',
  templateUrl: './admin-data-requests.component.html',
  styleUrls: ['./admin-data-requests.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminDataRequestsComponent implements OnInit, OnDestroy {
  requests: DataRequest[] = [];
  isLoading = true;
  loadError = '';
  busy: Record<string, boolean> = {};
  actionError: Record<string, string> = {};
  isSuper = false;

  private requestsSub?: Subscription;
  private auditSub?: Subscription;

  constructor(
    private dataRequests: DataRequestsService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCachedUser();
    this.isSuper = user?.roles?.super === true;
    this.requestsSub = this.dataRequests.requests$().subscribe({
      next: requests => {
        this.requests = [...requests].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Could not load data requests.';
        this.isLoading = false;
      },
    });
    this.auditSub = this.dataRequests.audit$().subscribe({ error: () => undefined });
  }

  ngOnDestroy(): void {
    this.requestsSub?.unsubscribe();
    this.auditSub?.unsubscribe();
  }

  canVerify(request: DataRequest): boolean {
    return request.status === 'open' && !request.verifiedAt;
  }

  canGrant(request: DataRequest): boolean {
    return this.isSuper && request.kind === 'removal' && request.status === 'open'
      && !!request.verifiedAt;
  }

  canRedact(request: DataRequest): boolean {
    return request.contact !== REDACTED_CONTACT
      && (request.status === 'resolved' || request.status === 'closed');
  }

  async resolve(request: DataRequest): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Resolve request?',
      message: 'Resolving records that no further action is needed. You can reopen the request if this was a mistake.',
      confirmLabel: 'Resolve',
      confirmTestId: 'admin-data-request-resolve-confirm',
    });
    if (confirmed) {
      await this.setStatus(request, 'resolved');
    }
  }

  async close(request: DataRequest): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Close request?',
      message: 'Closing ends the request. You can reopen it if this was a mistake.',
      confirmLabel: 'Close',
      confirmTestId: 'admin-data-request-close-confirm',
    });
    if (confirmed) {
      await this.setStatus(request, 'closed');
    }
  }

  async reopen(request: DataRequest): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Reopen request?',
      message: 'Reopening restores the open state and clears any recorded verification or grant. Audit entries are kept.',
      confirmLabel: 'Reopen',
      confirmTestId: 'admin-data-request-reopen-confirm',
    });
    if (confirmed) {
      await this.run(request, 'Could not reopen the request.',
        () => this.dataRequests.reopen(request.id, this.actorUid()));
    }
  }

  async verify(request: DataRequest): Promise<void> {
    await this.run(request, 'Could not record verification.',
      () => this.dataRequests.recordVerification(request.id, this.actorUid()));
  }

  async redact(request: DataRequest): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Erase request details?',
      message: 'This clears the stored contact and description. The request and its audit ids stay for the record.',
      confirmLabel: 'Erase details',
      destructive: true,
      confirmTestId: 'admin-data-request-redact-confirm',
    });
    if (confirmed) {
      await this.run(request, 'Could not erase the request details.',
        () => this.dataRequests.redact(request.id, this.actorUid()));
    }
  }

  async grant(request: DataRequest): Promise<void> {
    if (this.busy[request.id]) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Grant data removal?',
      message:
        'Identity is recorded as verified. Export the affected record first; the removal cannot be '
        + 'undone. Granting records the decision and an audit entry in one atomic write.',
      confirmLabel: 'Grant removal',
      destructive: true,
      confirmTestId: 'admin-data-request-grant-confirm',
    });
    if (!confirmed) {
      return;
    }
    this.busy[request.id] = true;
    this.actionError[request.id] = '';
    try {
      await this.dataRequests.grantRemoval(request, this.actorUid());
    } catch (error) {
      this.actionError[request.id] = (error as Error)?.message || 'Could not grant the removal.';
    } finally {
      this.busy[request.id] = false;
    }
  }

  private async run(request: DataRequest, fallback: string, action: () => Promise<void>): Promise<void> {
    if (this.busy[request.id]) {
      return;
    }
    this.busy[request.id] = true;
    this.actionError[request.id] = '';
    try {
      await action();
    } catch (error) {
      this.actionError[request.id] = (error as Error)?.message || fallback;
    } finally {
      this.busy[request.id] = false;
    }
  }

  private async setStatus(request: DataRequest, status: DataRequestStatus): Promise<void> {
    if (this.busy[request.id]) {
      return;
    }
    this.busy[request.id] = true;
    this.actionError[request.id] = '';
    try {
      await this.dataRequests.setStatus(request.id, status, this.actorUid());
    } catch (error) {
      this.actionError[request.id] = (error as Error)?.message || 'Could not update the request.';
    } finally {
      this.busy[request.id] = false;
    }
  }

  private actorUid(): string {
    return this.authService.getCachedUser()?.id || '';
  }
}
