import { Component, Input, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Doc, Media } from 'src/app/models/media';

@Component({
  selector: 'app-doc-viewer',
  templateUrl: './doc-viewer.component.html',
  styleUrls: ['./doc-viewer.component.scss']
})
export class DocViewerComponent implements OnInit {
  @Input() doc: Doc;
  url: string;
  pdfThing: string;
  isLoading: boolean;

  private eventsSubscription: Subscription;
  @Input() events: Observable<Media>;

  constructor() { }

  ngOnInit(): void {
    this.isLoading = true;

    this.url = this.doc.url;

    this.eventsSubscription = this.events.subscribe((media) => {
      this.url = media.url;
    });
  }

  ngOnDestroy() {
    this.eventsSubscription.unsubscribe();
  }

  onPdfLoaded() {
    this.isLoading = false;
  }

}
