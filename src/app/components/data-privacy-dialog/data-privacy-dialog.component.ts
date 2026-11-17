import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DataRequestInput, validateDataRequest } from 'src/app/models/data-request';
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
  contact = '';
  description = '';
  error = '';
  fieldErrors: Record<string, string> = {};
  submitted = false;
  busy = false;
  readonly successMessage =
    'Thank you. We will read your message and reply to your email.';

  @ViewChild('successPanel') successPanel?: ElementRef<HTMLElement>;

  constructor(
    private dataRequests: DataRequestsService,
    private authService: AuthService,
    private dialogRef: MatDialogRef<DataPrivacyDialogComponent>,
  ) {
    // Signed-in visitors shouldn't retype the address we already know; the
    // field stays editable so they can still give a different one.
    this.contact = this.authService.getCachedUser()?.email ?? '';
  }

  close(): void {
    this.dialogRef.close();
  }

  async submit(): Promise<void> {
    if (this.busy) {
      return;
    }
    const input: DataRequestInput = {
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
      this.error = (error as Error)?.message || 'We could not send your message. Try again.';
    } finally {
      this.busy = false;
    }
  }
}
