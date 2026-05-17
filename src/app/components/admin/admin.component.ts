import { Component, OnInit } from '@angular/core';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { VersionService } from 'src/app/services/version.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  user: User;
  version: string;

  constructor(
    private authService: AuthService,
    private versionService: VersionService,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.setVersion();
  }

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private setVersion(): void {
    this.version = this.versionService.getAppVersion();
  }
}