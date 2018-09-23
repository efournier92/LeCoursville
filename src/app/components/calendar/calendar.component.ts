import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  pdfSrc: string = './assets/test.pdf';
  page: number = 1;
  months: Object[];

  constructor() { }

  ngOnInit() {
    this.months = [
      { name: 'January', page: '1' }, 
      { name: 'February', page: '2' }, 
      { name: 'March', page: '3' }, 
      { name: 'April', page: '4' }, 
      { name: 'May', page: '5' }, 
      { name: 'June', page: '6' }, 
      { name: 'July', page: '7' }, 
      { name: 'August', page: '8' }, 
      { name: 'September', page: '9' }, 
      { name: 'October', page: '10' }, 
      { name: 'November', page: '11' }, 
      { name: 'December', page: '12' }, 
    ];
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

}
