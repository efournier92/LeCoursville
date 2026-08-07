import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { PhotoUploadProgressComponent } from './photo-upload-progress.component';
import { PhotoUpload } from 'src/app/services/photos.service';

function makeUpload(): PhotoUpload {
  return {
    photo: { id: 'photo-1', url: '', title: 'Sunset' } as any,
    task: { percentageChanges: () => of(50) } as any,
    onUrlAvailable: new BehaviorSubject<string>(''),
  };
}

describe('PhotoUploadProgressComponent', () => {
  let component: PhotoUploadProgressComponent;
  let fixture: ComponentFixture<PhotoUploadProgressComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, PhotoUploadProgressComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PhotoUploadProgressComponent);
    component = fixture.componentInstance;
    component.upload = makeUpload();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes upload progress from the task', () => {
    let progress: number | undefined;
    component.uploadProgress.subscribe(p => (progress = p));
    expect(progress).toBe(50);
  });

  it('marks the upload finished and emits the photo when the URL arrives', () => {
    let completed: any;
    component.completeUploadEvent.subscribe(photo => (completed = photo));

    (component.upload.onUrlAvailable as BehaviorSubject<string>).next('https://example.com/photo.jpg');

    expect(component.uploadFinished).toBe(true);
    expect(component.photo.url).toBe('https://example.com/photo.jpg');
    expect(completed).toBeTruthy();
  });

  it('ignores empty URL seeds from the upload task', () => {
    component.uploadFinished = false;
    (component.upload.onUrlAvailable as BehaviorSubject<string>).next('');
    expect(component.uploadFinished).toBe(false);
  });
});
