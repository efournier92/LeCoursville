import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { FileInputComponent } from './file-input.component';

describe('FileInputComponent', () => {
  let component: FileInputComponent;
  let fixture: ComponentFixture<FileInputComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ FileInputComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FileInputComponent);
    component = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  it('allows a single file unless multiple is requested', () => {
    const input = () => fixture.nativeElement.querySelector('#file-input-file') as HTMLInputElement;

    expect(input().multiple).toBe(false);

    component.shouldAllowMultipleFiles = true;
    fixture.detectChanges();

    expect(input().multiple).toBe(true);
  });

  it('renders the file label only when asked', () => {
    expect(fixture.nativeElement.querySelector('#file-input-text')).toBeNull();

    component.shouldShowLabel = true;
    component.inputPlaceholder = 'Choose a file';
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('#file-input-text').getAttribute('placeholder'),
    ).toBe('Choose a file');
  });

  it('clears the input and emits when the cancel icon is clicked', () => {
    component.shouldShowClearButton = true;
    const input = fixture.nativeElement.querySelector('#file-input-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'photo.png')],
      configurable: true,
    });

    let cleared = 0;
    component.inputClearedEvent.subscribe(() => cleared++);
    fixture.detectChanges();

    const cancel = fixture.nativeElement.querySelector('.file-upload-cancel-icon');
    expect(cancel).not.toBeNull();

    cancel.click();
    fixture.detectChanges();

    expect(cleared).toBe(1);
    expect(component.inputPlaceholder).toBe(component.inputMessage);
  });
});
