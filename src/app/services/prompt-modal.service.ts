import { Injectable } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { PromptModalComponent } from "src/app/components/prompt-modal/prompt-modal.component";
import { PromptButton } from "../interfaces/prompt-button";

@Injectable({
  providedIn: "root",
})
export class PromptModalService {
  constructor(public dialog: MatDialog) {}

  public openDialog(
    header: string,
    message: string,
    buttons: PromptButton[] = [],
  ): MatDialogRef<PromptModalComponent, any> {
    const dialogRef = this.dialog.open(PromptModalComponent, {
      data: {
        header,
        message,
        buttons,
      },
    });

    return dialogRef;
  }
}
