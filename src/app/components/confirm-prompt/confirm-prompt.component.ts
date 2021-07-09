import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogData } from 'src/app/components/calendar/calendar-dialog/calendar-dialog.component';

@Component({
  selector: 'app-confirm-prompt',
  templateUrl: './confirm-prompt.component.html',
  styleUrls: ['./confirm-prompt.component.scss']
})
export class ConfirmPromptComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<ConfirmPromptComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) { }

  onCancelClick(): void {
    this.dialogRef.close('');
  }

  onActionClick(didUserConfirm) {
    this.dialogRef.close(didUserConfirm);
  }

  ngOnInit() {
  }

}
