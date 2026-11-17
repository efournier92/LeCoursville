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

  private requestsSub?: Subscription;

  constructor(
    private dataRequests: DataRequestsService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
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
  }

  ngOnDestroy(): void {
    this.requestsSub?.unsubscribe();
  }

  async close(request: DataRequest): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Close Request?',
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
      title: 'Reopen Request?',
      message: 'Reopening restores the open state.',
      confirmLabel: 'Reopen',
      confirmTestId: 'admin-data-request-reopen-confirm',
    });
    if (confirmed) {
      await this.setStatus(request, 'open');
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
    await this.run(request, 'Could not update the request.',
      () => this.dataRequests.setStatus(request.id, status, this.actorUid()));
  }

  private actorUid(): string {
    return this.authService.getCachedUser()?.id || '';
  }
}
