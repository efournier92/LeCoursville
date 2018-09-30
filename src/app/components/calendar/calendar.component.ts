import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import { Months } from './calendar';
import printJs from 'print-js'

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  pdfSrc: string = './assets/calendars/2018.pdf';
  page: number = 1;
  months: Object[] = Months;
  user: User;

  constructor(
    private auth: AuthService,
  ) { 

  }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  changePage(page: number) {
    this.page = Number(page);
  }

  pageForward() {
    if (this.page === 12) {
      this.page = 1;
    } else {
      this.page = this.page + 1;
    }
  }

  pageBackward() {
    if (this.page === 1) {
      this.page = 12;
    } else {
      this.page = this.page - 1;
    }
  }

  printPdf(path) {
    printJs(path);
  }
}
