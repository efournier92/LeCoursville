import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { PhotoUploadProgressComponent } from './photo-upload-progress.component';

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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
