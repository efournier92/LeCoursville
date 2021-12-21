import { AuthConfig } from 'src/app/auth.config'
import { environment } from 'src/environments/environment';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';
import { NgModule } from '@angular/core';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

// Imports
import { AngularFireModule } from '@angular/fire';
import { AngularFireDatabaseModule } from '@angular/fire/database';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { AngularFireAnalyticsModule } from '@angular/fire/analytics';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { ClipboardModule } from '@angular/cdk/clipboard'; 
import { FilterPipeModule } from 'ngx-filter-pipe';
import { FirebaseUIModule } from 'firebaseui-angular';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { LightgalleryModule } from 'lightgallery/angular';
import { MaterialModule } from 'src/app/modules/material.module';
import { NgxAudioPlayerModule } from 'ngx-audio-player';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { VgBufferingModule } from '@videogular/ngx-videogular/buffering';
import { VgControlsModule } from '@videogular/ngx-videogular/controls';
import { VgCoreModule } from '@videogular/ngx-videogular/core';
import { VgOverlayPlayModule } from '@videogular/ngx-videogular/overlay-play';

// Declarations
import { AdminComponent } from 'src/app/components/admin/admin.component';
import { AdminUsersComponent } from 'src/app/components/admin-users/admin-users.component';
import { AdminMediaComponent } from 'src/app/components/admin-media/admin-media.component';
import { AppComponent } from 'src/app/app.component';
import { AuthComponent } from 'src/app/components/auth/auth.component';
import { CalendarCellComponent } from 'src/app/components/calendar-cell/calendar-cell.component';
import { CalendarComponent } from 'src/app/components/calendar/calendar.component';
import { CalendarDialogComponent } from 'src/app/components/calendar-dialog/calendar-dialog.component';
import { CalendarPrinterComponent } from 'src/app/components/calendar-printer/calendar-printer.component';
import { CalendarViewComponent } from 'src/app/components/calendar-view/calendar-view.component';
import { ChatComponent } from 'src/app/components/chat/chat.component';
import { ChatEditComponent } from 'src/app/components/chat-edit/chat-edit.component';
import { ChatViewComponent } from 'src/app/components/chat-view/chat-view.component';
import { ConfirmPromptComponent } from 'src/app/components/confirm-prompt/confirm-prompt.component';
import { ContactEditComponent } from 'src/app/components/contacts/contact-edit/contact-edit.component';
import { ContactViewComponent } from 'src/app/components/contacts/contact-view/contact-view.component';
import { ContactsComponent } from 'src/app/components/contacts/contacts.component';
import { FileInputComponent } from 'src/app/components/file-input/file-input.component';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';
import { MediaListComponent } from 'src/app/components/media-list/media-list.component';
import { PhotoAlbumComponent } from './components/photo-album/photo-album.component';
import { PhotoUploadProgressComponent } from 'src/app/components/photo-upload-progress/photo-upload-progress.component';
import { PhotosComponent } from 'src/app/components/photos/photos.component';
import { VideoUploadDialogComponent } from 'src/app/components/video-upload-dialog/video-upload-dialog.component';
import { AudioPlayerComponent } from './components/audio-player/audio-player.component';
import { MediaTypesCheckboxesComponent } from './components/media-types-checkboxes/media-types-checkboxes.component';
import { MediaSearchInputComponent } from './components/media-search-input/media-search-input.component';
import { VideoPlayerDriveIframeComponent } from './components/video-player-drive-iframe/video-player-drive-iframe.component';
import { VideoPlayerVideogularComponent } from './components/video-player-videogular/video-player-videogular.component';
import { DocViewerNgxExtendedComponent } from './components/doc-viewer-ngx-extended/doc-viewer-ngx-extended.component';
import { DocViewerDriveIframeComponent } from './components/doc-viewer-drive-iframe/doc-viewer-drive-iframe.component';
import { AdminMediaUploadAudioAlbumComponent } from './admin-media-upload-audio-album/admin-media-upload-audio-album.component';
import { AudioComponent } from './audio/audio.component';

@NgModule({
  declarations: [
    AdminComponent,
    AdminMediaComponent,
    AdminUsersComponent,
    AppComponent,
    AuthComponent,
    CalendarCellComponent,
    CalendarComponent,
    CalendarDialogComponent,
    CalendarPrinterComponent,
    CalendarViewComponent,
    ChatComponent,
    ChatEditComponent,
    ChatViewComponent,
    ConfirmPromptComponent,
    ContactEditComponent,
    ContactViewComponent,
    ContactsComponent,
    FileInputComponent,
    MediaExplorerComponent,
    MediaListComponent,
    PhotoAlbumComponent,
    PhotoUploadProgressComponent,
    PhotosComponent,
    VideoUploadDialogComponent,
    AudioPlayerComponent,
    MediaTypesCheckboxesComponent,
    MediaSearchInputComponent,
    VideoPlayerDriveIframeComponent,
    VideoPlayerVideogularComponent,
    DocViewerNgxExtendedComponent,
    DocViewerDriveIframeComponent,
    AdminMediaUploadAudioAlbumComponent,
    AudioComponent,
  ],
  imports: [
    AngularFireModule.initializeApp(environment.firebaseConfig),
    AngularFireAnalyticsModule,
    AngularFireDatabaseModule,
    AngularFireStorageModule,
    AngularFireAuthModule,
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    ClipboardModule,
    FilterPipeModule,
    FirebaseUIModule.forRoot(AuthConfig),
    FontAwesomeModule,
    FormsModule,
    HttpClientModule,
    InfiniteScrollModule,
    LightgalleryModule,
    MaterialModule,
    NgxAudioPlayerModule,
    NgxExtendedPdfViewerModule,
    ReactiveFormsModule,
    VgBufferingModule,
    VgControlsModule,
    VgCoreModule,
    VgOverlayPlayModule,
  ],
  providers: [
    { provide: LocationStrategy, useClass: PathLocationStrategy },
  ],
  bootstrap: [
    AppComponent,
  ],
  entryComponents: [
    CalendarDialogComponent,
    CalendarPrinterComponent,
    ConfirmPromptComponent,
  ],
  exports: [
    ContactEditComponent,
  ]
})
export class AppModule { }
