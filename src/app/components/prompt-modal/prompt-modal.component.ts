import { Component, OnInit, Inject } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { DialogData } from "src/app/interfaces/dialog-data";
import { PromptButton } from "../../interfaces/prompt-button";

@Component({
  selector: "app-prompt-modal",
  templateUrl: "./prompt-modal.component.html",
  styleUrls: ["./prompt-modal.component.scss"],
})
export class PromptModalComponent implements OnInit {
  buttons: PromptButton[];
  constructor(
    public dialogRef: MatDialogRef<PromptModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  // LIFECYCLE EVENTS

  ngOnInit() {
    const configuredButtons = this.dialogRef.componentInstance.data.buttons;
    if (configuredButtons?.length) {
      this.buttons = configuredButtons;
    } else {
      this.buttons = this.getDefaultButtons();
    }
  }

  // PUBLIC METHODS

  onCancelClick(): void {
    this.dialogRef.close("");
  }

  onActionClick(didUserConfirm: boolean) {
    this.dialogRef.close(didUserConfirm);
  }

  private getDefaultButtons(): PromptButton[] {
    return [
      {
        label: "No",
        color: "warn",
        isConfirmAction: false,
      },
      {
        label: "Yes",
        color: "primary",
        isConfirmAction: true,
      },
    ];
  }
}
