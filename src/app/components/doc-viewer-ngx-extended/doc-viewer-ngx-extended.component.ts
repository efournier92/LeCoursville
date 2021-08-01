import { Component, Input, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Doc, Media } from 'src/app/models/media';

@Component({
  selector: 'app-doc-viewer-ngx-extended',
  templateUrl: './doc-viewer-ngx-extended.component.html',
  styleUrls: ['./doc-viewer-ngx-extended.component.scss']
})
export class DocViewerNgxExtendedComponent implements OnInit {
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
