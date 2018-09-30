import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import { CalendarService } from './calendar.service';
import { Calendar, Months } from './calendar';
import { AngularFireList } from '@angular/fire/database';
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
    private calendar: CalendarService,
  ) { }

  ngOnInit() {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
      
    )
  }

  printPdf(path) {
    printJs(path);
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

  downloadFile(){
    console.log('hit')
    var blob = new Blob(['./assets/calendars/2018.pdf'], { type: 'application/pdf' });
    var url= window.URL.createObjectURL(blob);
    window.open(url);
  }
    // public async downloadZip(): Promise<void> {
    //   // const blob = await this.downloadResource(this.id);
    //   const url = window.URL.createObjectURL(blob);
      
    //   const link = this.downloadZipLink.nativeElement;
    //   link.href = url;
    //   link.download = 'archive.zip';
    //   link.click();
    
    //   window.URL.revokeObjectURL(url);
      
    // }
}
