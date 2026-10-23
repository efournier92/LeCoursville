import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TestSharedModule } from '../../../test-shared.module';

import { PhotoAlbumComponent } from './photo-album.component';

describe('PhotoAlbumComponent', () => {
  let component: PhotoAlbumComponent;
  let fixture: ComponentFixture<PhotoAlbumComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestSharedModule, RouterTestingModule],
      declarations: [ PhotoAlbumComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PhotoAlbumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hides the album while there are no photos', () => {
    expect(fixture.nativeElement.querySelector('.photo-album-container')).toBeNull();
  });

  it('points the deprecation note at /photos', () => {
    component.photos = [{ url: '/photo.jpg', title: 'Beach' }] as any;
    fixture.detectChanges();

    const note = fixture.nativeElement.querySelector('.photo-album-deprecated-note');
    const link = note.querySelector('a');

    expect(link.textContent.trim()).toBe('Photos');
    expect(link.getAttribute('href')).toBe('/photos');
  });

  it('renders one grid image per photo', () => {
    component.photos = [
      { url: '/one.jpg', title: 'One' },
      { url: '/two.jpg', title: '' },
    ] as any;
    fixture.detectChanges();

    const images = fixture.nativeElement.querySelectorAll('.photo-album-grid img');

    expect(images.length).toBe(2);
    expect(images[0].getAttribute('src')).toBe('/one.jpg');
    expect(images[0].getAttribute('alt')).toBe('One');
    expect(images[1].getAttribute('alt')).toBe('Photo');
  });
});
