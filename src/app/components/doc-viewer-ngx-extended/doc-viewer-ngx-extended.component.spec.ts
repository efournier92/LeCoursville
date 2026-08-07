import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { DocViewerNgxExtendedComponent } from './doc-viewer-ngx-extended.component';

function makeDoc(): any {
  return { id: 'doc-1', title: 'Report', urls: { download: 'https://example.com/report.pdf' } };
}

describe('DocViewerNgxExtendedComponent', () => {
  let component: DocViewerNgxExtendedComponent;
  let fixture: ComponentFixture<DocViewerNgxExtendedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [DocViewerNgxExtendedComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DocViewerNgxExtendedComponent);
    component = fixture.componentInstance;
    component.doc = makeDoc();
    component.events = of(makeDoc());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the document url from the doc input', () => {
    expect(component.url).toBe('https://example.com/report.pdf');
    expect(component.isLoading).toBe(true);
  });

  it('marks the viewer loaded when the pdf loads', () => {
    component.isLoading = true;
    component.onPdfLoaded();
    expect(component.isLoading).toBe(false);
  });
});
