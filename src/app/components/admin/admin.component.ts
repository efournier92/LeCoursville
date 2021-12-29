import { Component, OnInit } from '@angular/core';
import { RoutingService } from 'src/app/services/routing.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {

  constructor(
    private routingService: RoutingService,
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
