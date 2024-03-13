import { Injectable } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { PromptModalComponent } from 'src/app/components/prompt-modal/prompt-modal.component';
import { AnalyticsService } from './services/analytics.service';
import { PromptModalService } from './services/prompt-modal.service';
import { AuthService } from './services/auth.service';
import { User } from 'src/app/models/user';

abstract class ErrorsConstants {
  static readonly SELECTORS: any = {
    NAVBAR_LINKS: 'lecoursville-navbar-links',
    AUTH_CONTAINER: 'firebaseui-auth-container',
  };
  static readonly EVENTS: any = {
    NO_INPUTS_ON_LOGIN_ERROR: 'NoInputsOnLoginError',
    GENERIC_ERROR: 'Error',
  };
  static readonly EVENT_LISTENERS: any = {
    GENERIC_ERROR: 'error',
  };
  static readonly TIMING: any = {
    MS_BEFORE_ERROR_DETECTION: 12000,
  };
}

@Injectable({
  providedIn: 'root',
})
export class ErrorsService {
  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    private promptModal: PromptModalService,
  ) {}

  checkForNoInputsOnLogin(user: User) {
    setTimeout(() => {
      const navbarLinks = window.document.getElementById(
        ErrorsConstants.SELECTORS.NAVBAR_LINKS,
      );

      const authContainer = window.document.getElementById(
        ErrorsConstants.SELECTORS.AUTH_CONTAINER,
      );

      if (!navbarLinks && !authContainer.children.length) {
        this.analyticsService.logEvent(
          ErrorsConstants.EVENTS.NO_INPUTS_ON_LOGIN_ERROR,
          {
            userAgent: window?.navigator?.userAgent,
            userId: user?.id,
          },
        );

        const dialogRef = this.openErrorDialog();
        dialogRef.afterClosed().subscribe((isPromptAcknowledged: boolean) => {
          if (isPromptAcknowledged) {
            this.authService.signOut();
          }
        });
      }
    }, ErrorsConstants.TIMING.MS_BEFORE_ERROR_DETECTION);
  }

  listenForErrors(user: User) {
    window.addEventListener(
      ErrorsConstants.EVENT_LISTENERS.GENERIC_ERROR,
      (err: ErrorEvent) => {
        this.analyticsService.logEvent(ErrorsConstants.EVENTS.GENERIC_ERROR, {
          message: err?.message,
          value: err?.lineno,
          userAgent: window?.navigator?.userAgent,
          userId: user?.id,
        });
      },
    );
  }

  // HELPER METHODS

  private openErrorDialog(): MatDialogRef<PromptModalComponent, any> {
    return this.promptModal.openDialog(
      'Sorry, we encountered an error. We need to sign you out.',
      'If this keeps happening, please contact Eric at efournier92@gmail.com.',
      [
        {
          label: 'Sign Out',
          color: 'warn',
          isConfirmAction: true,
        },
      ],
    );
  }
}
