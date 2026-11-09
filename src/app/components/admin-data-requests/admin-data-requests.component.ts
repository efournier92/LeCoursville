import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DataRequest, DataRequestStatus } from 'src/app/models/data-request';
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

  canGrant(request: DataRequest): boolean {
    return this.isSuper && request.kind === 'removal' && request.status === 'open';
  }

  async resolve(request: DataRequest): Promise<void> {
    await this.setStatus(request, 'resolved');
  }

  async close(request: DataRequest): Promise<void> {
    await this.setStatus(request, 'closed');
  }

  async grant(request: DataRequest): Promise<void> {
    if (this.busy[request.id]) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Grant data removal?',
      message:
        'Export the affected record first; the removal cannot be undone. Granting records the '
        + 'decision and keeps a minimal audit entry.',
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
      await this.dataRequests.grantRemoval(request.id, this.actorUid());
    } catch (error) {
      this.actionError[request.id] = (error as Error)?.message || 'Could not grant the removal.';
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
