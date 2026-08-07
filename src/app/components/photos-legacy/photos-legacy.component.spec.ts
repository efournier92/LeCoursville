import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotosLegacyComponent } from './photos-legacy.component';

describe('PhotosLegacyComponent', () => {
  let component: PhotosLegacyComponent;
  let fixture: ComponentFixture<PhotosLegacyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [PhotosLegacyComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PhotosLegacyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
