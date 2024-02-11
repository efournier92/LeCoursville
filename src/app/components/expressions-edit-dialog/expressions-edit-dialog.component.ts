import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Expression } from 'src/app/models/expression';

export interface DialogData {
  animal: string;
  name: string;
}

@Component({
  selector: 'app-expressions-edit-dialog',
  templateUrl: 'expressions-edit-dialog.component.html',
})
export class ExpressionsEditDialogComponent {
  expression: Expression;

  constructor(
    public dialogRef: MatDialogRef<ExpressionsEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) { }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSaveClick(): void {
    console.log('Expression', this.expression);
  }
}
