import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { AudioPlayerComponent } from 'src/app/components/audio-player/audio-player.component';
import { DocViewerNgxExtendedComponent } from 'src/app/components/doc-viewer-ngx-extended/doc-viewer-ngx-extended.component';
import { MediaAudioComponent } from 'src/app/components/media-audio/media-audio.component';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';
import { MediaSearchInputComponent } from 'src/app/components/media-search-input/media-search-input.component';
import { MediaTypesCheckboxesComponent } from 'src/app/components/media-types-checkboxes/media-types-checkboxes.component';
import { MediaVideoComponent } from 'src/app/components/media-video/media-video.component';
import { PhotoAlbumComponent } from 'src/app/components/photo-album/photo-album.component';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { SharedModule } from 'src/app/components/shared/shared.module';
import { VideoPlayerDriveIframeComponent } from 'src/app/components/video-player-drive-iframe/video-player-drive-iframe.component';
import { VideoPlayerVideogularComponent } from 'src/app/components/video-player-videogular/video-player-videogular.component';
import { MaterialModule } from 'src/app/modules/material.module';
import { FeatureFlagGuard } from 'src/app/services/feature-flag-guard.service';

const routes: Routes = [
  {
    path: 'explorer',
    component: MediaExplorerComponent,
  },
  {
    path: 'audio',
    component: MediaAudioComponent,
    canActivate: [FeatureFlagGuard],
    data: { featureId: 'music' },
  },
  {
    path: 'video',
    component: MediaVideoComponent,
    canActivate: [FeatureFlagGuard],
    data: { featureId: 'videos' },
  },
];

@NgModule({
  declarations: [
    MediaExplorerComponent,
    MediaAudioComponent,
    MediaVideoComponent,
    AudioPlayerComponent,
    VideoPlayerDriveIframeComponent,
    VideoPlayerVideogularComponent,
    DocViewerNgxExtendedComponent,
    PhotoAlbumComponent,
    MediaTypesCheckboxesComponent,
    MediaSearchInputComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule.forChild(routes),
    SharedModule,
    PageToolbarComponent,
    NgxExtendedPdfViewerModule,
  ],
})
export class MediaFeatureModule {}
