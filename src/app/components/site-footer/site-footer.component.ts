import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DataPrivacyDialogComponent } from 'src/app/components/data-privacy-dialog/data-privacy-dialog.component';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.component.html',
  styleUrls: ['./site-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SiteFooterComponent {
  constructor(private dialog: MatDialog) {}

  openPrivacyDialog(): void {
    this.dialog.open(DataPrivacyDialogComponent, {
      width: '560px',
      maxWidth: '92vw',
      maxHeight: '90vh',
    });
  }
}
