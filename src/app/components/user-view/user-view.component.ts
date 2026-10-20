import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { FirebaseService } from 'src/app/services/firebase.service';

@Component({
    selector: 'app-user-view',
    templateUrl: './user-view.component.html',
    styleUrls: ['./user-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UserViewComponent implements OnInit {
  @Input() userOnCard: User;

  @Output() editClickedEvent = new EventEmitter();

  googleConnected = false;
  connecting = false;
  connectError = "";

  constructor(
    private authService: AuthService,
    private firebase: FirebaseService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.googleConnected = this.isGoogleConnected();
  }

  // PUBLIC METHODS

  get initials(): string {
    const name = this.userOnCard?.name?.trim();
    if (!name) {
      return "?";
    }
    const parts = name.split(/\s+/);
    const first = parts[0]?.charAt(0) || "";
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

  shouldDisplayRoles(): boolean {
    return this.isAdminUser();
  }

  onEdit(): void {
    this.editClickedEvent.emit();
  }

  isAdminUser(): boolean {
    return this.userOnCard?.roles?.admin;
  }

  isSuperUser(): boolean {
    return this.userOnCard?.roles?.super;
  }

  shouldDisplayUserId(): boolean {
    return this.isAdminUser() || this.isSuperUser();
  }

  isGoogleConnected(): boolean {
    return !!this.firebase.auth.currentUser?.providerData?.some(
      (provider) => provider.providerId === "google.com"
    );
  }

  async onConnectGoogle(): Promise<void> {
    this.connecting = true;
    this.connectError = "";
    try {
      await this.authService.linkGoogle();
      this.googleConnected = true;
    } catch (e: any) {
      this.connectError = this.mapLinkError(e?.code || "");
    } finally {
      this.connecting = false;
    }
  }

  private mapLinkError(code: string): string {
    switch (code) {
      case "auth/credential-already-in-use":
      case "auth/email-already-in-use":
        return "That Google account is already connected to another account.";
      case "auth/popup-blocked":
        return "Your browser blocked the Google popup. Allow popups and try again.";
      case "auth/popup-closed-by-user":
        return "Google connection was cancelled.";
      default:
        return "Couldn't connect Google. Try again.";
    }
  }
}
