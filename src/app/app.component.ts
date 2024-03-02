import { Component, OnInit } from "@angular/core";
import { AuthService } from "src/app/services/auth.service";
import { VersionService } from "./services/version.service";
import { ErrorsService } from "src/app/errors.service";
import { User } from "src/app/models/user";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  user: User;

  constructor(
    private authService: AuthService,
    private versionService: VersionService,
    private errorsService: ErrorsService,
  ) {}

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => (this.user = user),
    );
  }

  ngOnInit() {
    this.subscribeToUserObservable();
    this.versionService.writeVersionToWindow();
    this.errorsService.listenForErrors(this.user);
    this.errorsService.checkForNoInputsOnLogin(this.user);
  }

  // HELPERS
}
