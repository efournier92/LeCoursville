import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  DATA_REQUEST_CLASSES,
  DataRequestClass,
  DataRequestInput,
  DataRequestKind,
  validateDataRequest,
} from 'src/app/models/data-request';
import { AuthService } from 'src/app/services/auth.service';
import { DataRequestsService } from 'src/app/services/data-requests.service';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.component.html',
  styleUrls: ['./site-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SiteFooterComponent {
  readonly dataClasses = DATA_REQUEST_CLASSES;
  readonly kindLabels: Record<DataRequestKind, string> = {
    removal: 'Request data removal',
    update: 'Request data update',
    contact: 'Contact us',
  };
  readonly actions: { kind: DataRequestKind; label: string }[] = [
    { kind: 'removal', label: this.kindLabels.removal },
    { kind: 'update', label: this.kindLabels.update },
    { kind: 'contact', label: this.kindLabels.contact },
  ];

  kind: DataRequestKind | null = null;
  dataClass: DataRequestClass = 'people';
  contact = '';
  description = '';
  error = '';
  fieldErrors: Record<string, string> = {};
  submitted = false;
  busy = false;

  constructor(
    private dataRequests: DataRequestsService,
    private authService: AuthService,
  ) {}

  openForm(kind: DataRequestKind): void {
    this.kind = kind;
    this.dataClass = kind === 'contact' ? 'other' : 'people';
    this.submitted = false;
    this.error = '';
    this.fieldErrors = {};
  }

  closeForm(): void {
    this.kind = null;
    this.submitted = false;
    this.error = '';
    this.fieldErrors = {};
  }

  async submit(): Promise<void> {
    if (!this.kind || this.busy) {
      return;
    }
    const input: DataRequestInput = {
      kind: this.kind,
      dataClass: this.dataClass,
      contact: this.contact,
      description: this.description,
    };
    this.fieldErrors = validateDataRequest(input);
    if (Object.keys(this.fieldErrors).length > 0) {
      this.error = 'Check the highlighted fields.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const requesterUid = this.authService.getCachedUser()?.id ?? null;
      await this.dataRequests.create(input, requesterUid);
      this.submitted = true;
      this.contact = '';
      this.description = '';
    } catch (error) {
      this.error = (error as Error)?.message || 'We could not send your request. Try again.';
    } finally {
      this.busy = false;
    }
  }
}
