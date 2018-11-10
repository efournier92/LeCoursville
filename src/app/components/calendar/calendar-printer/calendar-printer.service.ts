import { Injectable } from '@angular/core';
import * as jspdf from 'node_modules/jspdf/dist/jspdf.debug.js';
import html2canvas from 'html2canvas';
import { Months } from '../calendar.service';

@Injectable({
  providedIn: 'root'
})
export class CalendarPrinterService {

  constructor() { }

  public printPdf() {
    let pdf = new jspdf('l', 'mm', 'letter');
    const months = Months;
    for (const month of months) {
      let data = document.getElementById('calendarPrintView');
      html2canvas(data).then(
        (canvas) => {
          const imgWidth = pdf.internal.pageSize.getWidth();
          const imgHeight = canvas.height * imgWidth / canvas.width;
          const contentDataURL = canvas.toDataURL('image/png');
          const position = 0;
          pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);
          pdf.addPage();
        });
    }
    pdf.save('MYPdf.pdf');
  }
}
