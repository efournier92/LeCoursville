import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})
export class PdfViewerComponent implements OnInit {
  pdfThing: string;

  constructor() { }

  ngOnInit(): void {
    this.pdfThing = "https://www.googleapis.com/drive/v3/files/1stIuTD7_C6rBA0CuTfD4Fz7HnqmyyJ4k?alt=media&key=AIzaSyB0O5xzuR9PvyU_5YHq8byjOcMk1adqbVg";
  }

}
