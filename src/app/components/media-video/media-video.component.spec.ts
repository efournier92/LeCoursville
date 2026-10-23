import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { MediaVideoComponent } from './media-video.component';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';
import { MediaFeatureModule } from 'src/app/components/media/media.module';
import { MediaConstants } from 'src/app/constants/media-constants';

describe('MediaVideoComponent', () => {
  let component: MediaVideoComponent;
  let fixture: ComponentFixture<MediaVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MediaFeatureModule],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the media explorer for the video type under a Videos title', () => {
    const explorer = fixture.debugElement.query(By.directive(MediaExplorerComponent));

    expect(explorer).not.toBeNull();
    expect(explorer.componentInstance.mediaTypesToShow).toBe(MediaConstants.VIDEO.id);
    expect(explorer.componentInstance.title).toBe('Videos');
  });
});
