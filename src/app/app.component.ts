import { Component, OnInit } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { AuthService } from "src/app/services/auth.service";
import { AnalyticsService } from "./services/analytics.service";
import { VersionService } from "./services/version.service";
import { PromptModalService } from "./services/prompt-modal.service";
import { PromptModalComponent } from "src/app/components/prompt-modal/prompt-modal.component";
import { User } from "src/app/models/user";

declare global {
  interface Window {
    version: any;
  }
}

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  user: User;

  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    private versionService: VersionService,
    private promptModal: PromptModalService,
  ) {}

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => (this.user = user),
    );
  }

  ngOnInit() {
    this.subscribeToUserObservable();
    this.writeVersionToWindow();
    this.listenForErrors();
    this.detectErrorState();
  }

  // HELPERS

  private writeVersionToWindow() {
    window.version = this.versionService.getAppVersion();
  }

  private detectErrorState() {
    setTimeout(() => {
      const navbarLinks = window.document.getElementById(
        "lecoursville-navbar-links",
      );

      const authContainer = window.document.getElementById(
        "firebaseui-auth-container",
      );

      if (!navbarLinks && !authContainer.children.length) {
        this.analyticsService.logEvent("ErrorState", {
          message: "TODO",
        });

        const dialogRef = this.openErrorDialog();
        dialogRef.afterClosed().subscribe((signOutConfirmed: boolean) => {
          if (signOutConfirmed) {
            this.authService.signOut();
          }
        });
      }
    }, 5000);
  }

  openErrorDialog(): MatDialogRef<PromptModalComponent, any> {
    return this.promptModal.openDialog(
      "Sorry, we encountered an error. We need to sign you out.",
      "If this keeps happening, please contact Eric at efournier92@gmail.com.",
      [
        {
          label: "Sign Out",
          color: "warn",
          isConfirmAction: true,
        },
      ],
    );
  }

  private listenForErrors() {
    window.addEventListener("error", (err: ErrorEvent) => {
      this.analyticsService.logEvent("Error", {
        message: err?.message,
        value: err?.lineno,
        userAgent: window?.navigator?.userAgent,
        userId: this.user?.id,
      });
    });
  }
}
