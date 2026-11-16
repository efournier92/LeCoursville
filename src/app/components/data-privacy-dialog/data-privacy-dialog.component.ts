import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
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
  selector: 'app-data-privacy-dialog',
  templateUrl: './data-privacy-dialog.component.html',
  styleUrls: ['./data-privacy-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DataPrivacyDialogComponent {
  readonly dataClasses = DATA_REQUEST_CLASSES;
  readonly panelHeadings: Record<DataRequestKind, string> = {
    update: 'Something wrong or out of date?',
    removal: 'Something we should stop sharing about you?',
    contact: 'Something else on your mind?',
  };
  readonly panelBodies: Record<DataRequestKind, string> = {
    update: 'Tell us what to fix or bring up to date, and the best way to reach you. We will review your request and reply.',
    removal: 'Ask us to stop sharing information about you. We will review your request before acting on it, and we reply either way.',
    contact: 'Send us a note about your information, with details and the way to reach you. We will review it and reply.',
  };
  readonly actions: { kind: DataRequestKind; label: string }[] = [
    { kind: 'update', label: 'Update' },
    { kind: 'removal', label: 'Remove' },
    { kind: 'contact', label: 'Contact' },
  ];
  readonly responseLine =
    'We review each request and reply to the email or phone you give us.';

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
    private dialogRef: MatDialogRef<DataPrivacyDialogComponent>,
  ) {}

  close(): void {
    this.dialogRef.close();
  }

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
