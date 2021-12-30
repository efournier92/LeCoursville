import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { UploadableMedia } from 'src/app/models/media/media';
import { Doc } from 'src/app/models/media/doc';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-doc-viewer-ngx-extended',
  templateUrl: './doc-viewer-ngx-extended.component.html',
  styleUrls: ['./doc-viewer-ngx-extended.component.scss']
})
export class DocViewerNgxExtendedComponent implements OnInit, OnDestroy {
  @Input() doc: Doc;
  @Input() events: Observable<UploadableMedia>;

  url: string;
  pdfThing: string;
  isLoading: boolean;

  private eventsSubscription: Subscription;

  constructor(
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToEventsObservable();
    this.initializeViewer();
    this.analyticsService.logEvent('component_load_doc_viewer', { });
  }

  ngOnDestroy(): void {
    this.eventsSubscription.unsubscribe();
  }

  // SUBSCRIPTIONS

  private subscribeToEventsObservable(): void {
    this.eventsSubscription = this.events.subscribe((media) => {
      this.url = media.urls.download;
    });
  }

  // PUBLIC METHODS

  onPdfLoaded() {
    this.isLoading = false;
  }

  // HELPER METHODS
  initializeViewer() {
    this.isLoading = true;
    this.url = this.doc.urls.download;
  }
}
