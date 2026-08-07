import { Component, OnInit, HostListener } from '@angular/core';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { VersionService } from 'src/app/services/version.service';
import { RoutingService } from 'src/app/services/routing.service';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  user: User;
  version: string;
  showPhotoAlbumsNav = false;

  constructor(
    private authService: AuthService,
    private versionService: VersionService,
    private routingService: RoutingService,
    private featureFlagsService: FeatureFlagsService,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.setVersion();
    this.featureFlagsService.getAllFeatureFlags().subscribe(flags => {
      this.showPhotoAlbumsNav = !!flags['enablePhotoAlbums']?.enabled;
    });
  }

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private setVersion(): void {
    this.version = this.versionService.getAppVersion();
  }

  get isSidenavOpen() {
    return this.routingService.sidenavOpen$;
  }

  toggleSidenav(): void {
    this.routingService.toggleSidenav();
  }

  closeSidenav(): void {
    this.routingService.closeSidenav();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.routingService.closeSidenav();
    }
  }
}