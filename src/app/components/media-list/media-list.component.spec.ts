import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { MediaListComponent } from './media-list.component';
import { UploadableMedia } from 'src/app/models/media/media';

function media(id: string): UploadableMedia {
  return {
    id,
    title: id,
    artist: '',
    date: '2020-1-2',
    folderName: '',
    fileName: '',
    isSticky: false,
    isHidden: false,
    listing: [],
    urls: { download: '', icon: '/icon.png' },
    type: 'video',
    format: 'video/mp4',
    dateUpdated: new Date(0),
  };
}

describe('MediaListComponent', () => {
  let component: MediaListComponent;
  let fixture: ComponentFixture<MediaListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ MediaListComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('pluralizes the admin item count', () => {
    component.isAdminMode = true;
    component.status = 'ready';
    component.filteredMedia = [media('one')];
    fixture.detectChanges();

    const count = () =>
      fixture.nativeElement.querySelector('.media-list-count').textContent.trim();

    expect(count()).toBe('1 item');

    component.filteredMedia = [media('one'), media('two')];
    fixture.detectChanges();

    expect(count()).toBe('2 items');
  });

  it('shows the filter field only in admin mode', () => {
    expect(
      fixture.nativeElement.querySelector('input[name="media-list-filters-input-search-query"]'),
    ).toBeNull();

    component.isAdminMode = true;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('input[name="media-list-filters-input-search-query"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.media-list-title').textContent.trim(),
    ).toBe('Library');
  });

  it('renders the skeleton while loading', () => {
    component.status = 'loading';
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector('.media-skeleton-list');
    expect(skeleton).not.toBeNull();
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.querySelectorAll('.media-skeleton-item').length).toBe(
      component.skeletonIterations.length,
    );
  });

  it('emits the selected media when a row is clicked', () => {
    const item = media('one');
    component.status = 'ready';
    component.filteredMedia = [item];
    fixture.detectChanges();

    const emitted: UploadableMedia[] = [];
    component.mediaClickEvent.subscribe(value => emitted.push(value));

    (fixture.nativeElement.querySelector('.media-list-item') as HTMLButtonElement).click();

    expect(emitted).toEqual([item]);
  });
});
