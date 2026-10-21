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
  private pending: Promise<boolean> | null = null;

  constructor(private dialog: MatDialog) {}

  public confirm(data: ConfirmDialogData): Promise<boolean> {
    // A second action while a dialog is open must not inherit the first
    // dialog's answer (it may be about different data), so deny it instead of
    // joining the in-flight promise. The open dialog still owns its own answer.
    if (this.pending) {
      return Promise.resolve(false);
    }
    this.pending = firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data,
          width: "420px",
          maxWidth: "calc(100vw - 32px)",
        })
        .afterClosed()
        .pipe(map((result) => result === true)),
    ).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
}
