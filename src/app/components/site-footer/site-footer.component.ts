import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
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
  readonly panelHeadings: Record<DataRequestKind, string> = {
    update: 'Update Your Information',
    removal: 'Remove Your Information',
    contact: 'Contact Us',
  };
  readonly panelBodies: Record<DataRequestKind, string> = {
    update: 'Tell us what is wrong or out of date, and the best way to reach you. We will record your request for review.',
    removal: 'Ask us to stop sharing information about you. We record the request and review it before any information is removed.',
    contact: 'For anything else, send us a note about your information.',
  };
  readonly actions: { kind: DataRequestKind; label: string }[] = [
    { kind: 'update', label: 'Update' },
    { kind: 'removal', label: 'Remove' },
    { kind: 'contact', label: 'Contact' },
  ];
  readonly responseLine =
    'We review requests and reply using the contact details you provide.';

  kind: DataRequestKind | null = null;
  dataClass: DataRequestClass = 'people';
  contact = '';
  description = '';
  error = '';
  fieldErrors: Record<string, string> = {};
  submitted = false;
  busy = false;
  readonly successMessage =
    'Thank you. We will review your request and reply using the contact details you gave us.';

  @ViewChild('successPanel') successPanel?: ElementRef<HTMLElement>;

  constructor(
    private dataRequests: DataRequestsService,
    private authService: AuthService,
  ) {}

  openForm(kind: DataRequestKind): void {
    this.kind = kind;
    this.dataClass = kind === 'contact' ? 'other' : 'people';
    this.contact = '';
    this.description = '';
    this.submitted = false;
    this.error = '';
    this.fieldErrors = {};
  }

  closeForm(): void {
    this.kind = null;
    this.contact = '';
    this.description = '';
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
      setTimeout(() => this.successPanel?.nativeElement.focus());
    } catch (error) {
      this.error = (error as Error)?.message || 'We could not send your request. Try again.';
    } finally {
      this.busy = false;
    }
  }
}
