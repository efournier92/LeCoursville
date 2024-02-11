import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ExpressionsEditDialogComponent } from '../expressions-edit-dialog/expressions-edit-dialog.component';

@Component({
  selector: 'app-expressions-edit',
  templateUrl: './expressions-edit.component.html',
  styleUrls: ['./expressions-edit.component.scss']
})
export class ExpressionsEditComponent {
  animal: string;
  name: string;

  constructor(public dialog: MatDialog) { }

  openExpressionsEditDialog(): void {
    const dialogRef = this.dialog.open(ExpressionsEditDialogComponent, {
      data: { name: this.name, animal: this.animal },
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      this.animal = result;
    });
  }
}
