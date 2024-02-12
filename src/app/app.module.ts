import { AuthConfig } from 'src/app/auth.config';
import { environment } from 'src/environments/environment';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';
import { NgModule } from '@angular/core';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

// Imports
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { AngularFireAnalyticsModule } from '@angular/fire/compat/analytics';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { FileSaverModule } from 'ngx-filesaver';
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
import { AudioPlayerComponent } from 'src/app/components/audio-player/audio-player.component';
import { MediaTypesCheckboxesComponent } from 'src/app/components/media-types-checkboxes/media-types-checkboxes.component';
import { MediaSearchInputComponent } from 'src/app/components/media-search-input/media-search-input.component';
import { VideoPlayerDriveIframeComponent } from 'src/app/components/video-player-drive-iframe/video-player-drive-iframe.component';
import { VideoPlayerVideogularComponent } from 'src/app/components/video-player-videogular/video-player-videogular.component';
import { DocViewerNgxExtendedComponent } from 'src/app/components/doc-viewer-ngx-extended/doc-viewer-ngx-extended.component';
import { AdminMediaUploadAudioAlbumComponent } from 'src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component';
import { AdminCalendarComponent } from 'src/app/components/admin-calendar/admin-calendar.component';
import { AdminRoutingComponent } from './components/admin-routing/admin-routing.component';
import { UserViewComponent } from './components/user-view/user-view.component';
import { UserEditComponent } from './components/user-edit/user-edit.component';
import { MediaAudioComponent } from 'src/app/components/media-audio/media-audio.component';
import { MediaVideoComponent } from './components/media-video/media-video.component';
import { AdminMediaUploadVideoComponent } from './components/admin-media-upload-video/admin-media-upload-video.component';
import { NavbarLinksComponent } from './components/navbar-links/navbar-links.component';
import { ExpressionsComponent } from './components/expressions/expressions.component';
import { ExpressionViewComponent } from 'src/app/components/expression-view/expression-view.component';
import { ExpressionsEditComponent } from './components/expressions-edit/expressions-edit.component';
import { ExpressionsEditDialogComponent } from './components/expressions-edit-dialog/expressions-edit-dialog.component';

@NgModule({
  declarations: [
    AdminComponent,
    AdminMediaComponent,
    AdminUsersComponent,
    AppComponent,
    AuthComponent,
    CalendarCellComponent,
    CalendarComponent,
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
    AudioPlayerComponent,
    MediaTypesCheckboxesComponent,
    MediaSearchInputComponent,
    VideoPlayerDriveIframeComponent,
    VideoPlayerVideogularComponent,
    DocViewerNgxExtendedComponent,
    AdminMediaUploadAudioAlbumComponent,
    AdminCalendarComponent,
    AdminRoutingComponent,
    UserViewComponent,
    UserEditComponent,
    MediaAudioComponent,
    MediaVideoComponent,
    AdminMediaUploadVideoComponent,
    NavbarLinksComponent,
    ExpressionsComponent,
    ExpressionViewComponent,
    ExpressionsEditComponent,
    ExpressionsEditDialogComponent,
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
    FileSaverModule,
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
    CalendarPrinterComponent,
    ConfirmPromptComponent,
    ExpressionsEditDialogComponent,
  ],
  exports: [
    ContactEditComponent,
  ]
})

export class AppModule { }
