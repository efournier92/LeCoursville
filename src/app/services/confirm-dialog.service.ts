import { Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { firstValueFrom, map } from "rxjs";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "src/app/components/confirm-dialog/confirm-dialog.component";

@Injectable({
  providedIn: "root",
})
export class ConfirmDialogService {
  constructor(private dialog: MatDialog) {}

  public confirm(data: ConfirmDialogData): Promise<boolean> {
    return firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data,
          width: "420px",
          maxWidth: "calc(100vw - 32px)",
        })
        .afterClosed()
        .pipe(map((result) => result === true)),
    );
  }
}
