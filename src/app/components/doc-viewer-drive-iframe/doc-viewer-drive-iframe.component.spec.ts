import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocViewerDriveIframeComponent } from './doc-viewer-drive-iframe.component';

describe('DocViewerDriveIframeComponent', () => {
  let component: DocViewerDriveIframeComponent;
  let fixture: ComponentFixture<DocViewerDriveIframeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DocViewerDriveIframeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DocViewerDriveIframeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
