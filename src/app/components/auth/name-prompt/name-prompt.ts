import { Component, Inject } from '@angular/core';
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material';

@Component({
    selector: 'name-prompt',
    templateUrl: 'name-prompt.html',
  })
  export class NamePrompt {

    constructor(
      public dialogRef: MatDialogRef<NamePrompt>,
      @Inject(MAT_DIALOG_DATA) public data: string) {}
  
    onNoClick(): void {
      this.dialogRef.close();
    }
  
  }
  