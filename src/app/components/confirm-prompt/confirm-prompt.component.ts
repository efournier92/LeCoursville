import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogData } from 'src/app/interfaces/dialog-data';

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

  // LIFECYCLE EVENTS

  ngOnInit() { }

  // PUBLIC METHODS

  onCancelClick(): void {
    this.dialogRef.close('');
  }

  onActionClick(didUserConfirm: boolean) {
    this.dialogRef.close(didUserConfirm);
  }
}
