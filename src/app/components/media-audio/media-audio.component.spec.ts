import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { MediaAudioComponent } from './media-audio.component';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';
import { MediaFeatureModule } from 'src/app/components/media/media.module';
import { MediaConstants } from 'src/app/constants/media-constants';

describe('AudioComponent', () => {
  let component: MediaAudioComponent;
  let fixture: ComponentFixture<MediaAudioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MediaFeatureModule],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaAudioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the media explorer for the audio album type under a Music title', () => {
    const explorer = fixture.debugElement.query(By.directive(MediaExplorerComponent));

    expect(explorer).not.toBeNull();
    expect(explorer.componentInstance.mediaTypesToShow).toBe(MediaConstants.AUDIO_ALBUM.id);
    expect(explorer.componentInstance.title).toBe('Music');
  });
});
