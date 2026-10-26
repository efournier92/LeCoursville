import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminMediaComponent } from './admin-media.component';

describe('AdminMediaComponent', () => {
  let component: AdminMediaComponent;
  let fixture: ComponentFixture<AdminMediaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ AdminMediaComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminMediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders both section switches', () => {
    const el: HTMLElement = fixture.nativeElement;
    const labels = Array.from(el.querySelectorAll('[data-testid^="media-section-"]')).map(
      button => button.textContent.trim(),
    );
    expect(labels).toEqual(['Video', 'Audio Album']);
    expect(el.textContent).not.toContain('TODO');
  });

  it('mounts one uploader per section, swapping panels without a blank state', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('app-admin-media-upload-video').length).toBe(1);
    expect(el.querySelectorAll('app-admin-media-upload-audio-album').length).toBe(0);

    component.section = 'audio';
    fixture.detectChanges();

    expect(el.querySelectorAll('app-admin-media-upload-video').length).toBe(0);
    expect(el.querySelectorAll('app-admin-media-upload-audio-album').length).toBe(1);
  });

  it('dismisses upload errors', () => {
    component.errorMessages = ['Uploaded file is not valid JSON.'];
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const dismiss = el.querySelector('.media-upload-error-messages .message-dismiss') as HTMLButtonElement;
    dismiss.click();
    fixture.detectChanges();

    expect(component.errorMessages).toEqual([]);
    expect(el.querySelector('.media-upload-error-messages')).toBeNull();
  });

  it('dismisses upload success messages', () => {
    component.successMessages = ['Successfully uploaded E2E Video'];
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.media-upload-success-messages .message-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.successMessages).toEqual([]);
  });
});
