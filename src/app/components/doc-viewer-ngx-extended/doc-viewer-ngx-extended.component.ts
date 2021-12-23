import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Media } from 'src/app/models/media/media';
import { Doc } from 'src/app/models/media/doc';

@Component({
  selector: 'app-doc-viewer-ngx-extended',
  templateUrl: './doc-viewer-ngx-extended.component.html',
  styleUrls: ['./doc-viewer-ngx-extended.component.scss']
})
export class DocViewerNgxExtendedComponent implements OnInit, OnDestroy {
  @Input() doc: Doc;
  @Input() events: Observable<Media>;

  url: string;
  pdfThing: string;
  isLoading: boolean;
  private eventsSubscription: Subscription;

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
