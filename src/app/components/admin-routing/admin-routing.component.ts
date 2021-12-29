import { Component, OnInit } from '@angular/core';
import { RoutingService } from 'src/app/services/routing.service';

@Component({
  selector: 'app-admin-routing',
  templateUrl: './admin-routing.component.html',
  styleUrls: ['./admin-routing.component.scss']
})
export class AdminRoutingComponent implements OnInit {

  constructor(
    private routingService: RoutingService
  ) { }

  ngOnInit(): void { }

  onClickUsersRoute() {
    this.routingService.NavigateToAdminUsers();
  }

  onClickMediaRoute() {
    this.routingService.NavigateToAdminMedia();
  }

  onClickCalendarRoute() {
    this.routingService.NavigateToAdminCalendar();
  }

}
