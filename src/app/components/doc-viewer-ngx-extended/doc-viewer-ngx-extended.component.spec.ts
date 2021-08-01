import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocViewerNgxExtendedComponent } from './doc-viewer-ngx-extended.component';

describe('DocViewerNgxExtendedComponent', () => {
  let component: DocViewerNgxExtendedComponent;
  let fixture: ComponentFixture<DocViewerNgxExtendedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DocViewerNgxExtendedComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DocViewerNgxExtendedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
