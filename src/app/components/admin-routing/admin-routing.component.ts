import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RoutingService } from 'src/app/services/routing.service';

@Component({
  selector: 'app-admin-routing',
  templateUrl: './admin-routing.component.html',
  styleUrls: ['./admin-routing.component.scss']
})
export class AdminRoutingComponent {

  constructor(
    private routingService: RoutingService,
    private router: Router
  ) { }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  onClickUsersRoute() {
    this.routingService.NavigateToAdminUsers();
  }

  onClickMediaRoute() {
    this.routingService.NavigateToAdminMedia();
  }

  onClickCalendarRoute() {
    this.routingService.NavigateToAdminCalendar();
  }

  onClickFeaturesRoute() {
    this.routingService.NavigateToAdminFeatures();
  }

  onClickClansRoute() {
    this.routingService.NavigateToAdminClans();
  }

  onClickPeopleImportRoute() {
    this.routingService.NavigateToAdminPeopleImport();
  }
}