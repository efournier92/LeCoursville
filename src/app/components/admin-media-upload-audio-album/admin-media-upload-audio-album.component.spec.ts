import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMediaUploadAudioAlbumComponent } from './admin-media-upload-audio-album.component';

describe('AdminMediaUploadAudioAlbumComponent', () => {
  let component: AdminMediaUploadAudioAlbumComponent;
  let fixture: ComponentFixture<AdminMediaUploadAudioAlbumComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminMediaUploadAudioAlbumComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminMediaUploadAudioAlbumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
