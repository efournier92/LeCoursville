import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material';
import { ConfirmPromptComponent } from './confirm-prompt.component';

@Injectable({
  providedIn: 'root'
})
export class ConfirmPromptService {

  constructor(
    public dialog: MatDialog,
  ) { }

  public openDialog(header: string, message: string): MatDialogRef<ConfirmPromptComponent, any> {
    const dialogRef = this.dialog.open(ConfirmPromptComponent, {
      width: '250px',
      data: {
        header: header,
        message: message,
      },
    });

    return dialogRef;
  }
}
