import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  pdfSrc: string = './assets/test.pdf';
  page: Number = 1;
  months: Object[];



  constructor() { }

  ngOnInit() {
    this.months = [
      { name: 'Jan', page: '1' }, 
      { name: 'Feb', page: '2' }, 
      { name: 'Mar', page: '3' }, 
      { name: 'Apr', page: '4' }, 
      { name: 'May', page: '5' }, 
      { name: 'Jun', page: '6' }, 
      { name: 'Jul', page: '7' }, 
      { name: 'Aug', page: '8' }, 
      { name: 'Sep', page: '9' }, 
      { name: 'Oct', page: '10' }, 
      { name: 'Nov', page: '11' }, 
      { name: 'Dec', page: '12' }, 
    ];
  }

}
