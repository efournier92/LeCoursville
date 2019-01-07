import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotoUploadProgressComponent } from './photo-upload-progress.component';

describe('PhotoUploadProgressComponent', () => {
  let component: PhotoUploadProgressComponent;
  let fixture: ComponentFixture<PhotoUploadProgressComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [PhotoUploadProgressComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PhotoUploadProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
