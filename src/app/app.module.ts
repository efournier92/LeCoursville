import { secrets } from 'src/environments/secrets.js';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';
import { FilterPipeModule } from 'ngx-filter-pipe';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { AngularFireModule } from '@angular/fire';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFireDatabaseModule } from '@angular/fire/database';
import { FirebaseUIModule } from 'firebaseui-angular';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { MaterialModule } from 'src/app/modules/material.module';
import { AuthConfig } from 'src/app/auth.config'
import { AppComponent } from 'src/app/app.component';
import { AuthComponent } from 'src/app/components/auth/auth.component';
import { ContactsComponent } from 'src/app/components/contacts/contacts.component';
import { CalendarComponent } from 'src/app/components/calendar/calendar.component';
import { PhotosComponent } from 'src/app/components/photos/photos.component';
import { EditContactComponent } from 'src/app/components/contacts/edit-contact/edit-contact.component';
import { ViewContactComponent } from 'src/app/components/contacts/view-contact/view-contact.component';
import { ChatComponent } from 'src/app/components/chat/chat.component';
import { ChatViewComponent } from 'src/app/components/chat/chat-view/chat-view.component';
import { ChatEditComponent } from 'src/app/components/chat/chat-edit/chat-edit.component';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarDialogComponent } from 'src/app/components/calendar/calendar-dialog/calendar-dialog.component';
import { CalendarPrinterComponent } from 'src/app/components/calendar/calendar-printer/calendar-printer.component';
import { CalendarViewComponent } from 'src/app/components/calendar/calendar-view/calendar-view.component';
import { CalendarCellComponent } from 'src/app/components/calendar/calendar-view/calendar-cell/calendar-cell.component';
import { AdminComponent } from 'src/app/components/admin/admin.component';
import { PhotoUploadProgressComponent } from 'src/app/components/photos/photo-upload-progress/photo-upload-progress.component';
import { ConfirmPromptComponent } from 'src/app/components/confirm-prompt/confirm-prompt.component';
import { FileInputComponent } from 'src/app/components/file-input/file-input.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { VideosComponent } from 'src/app/components/videos/videos.component';

import { VgCoreModule } from '@videogular/ngx-videogular/core';
import { VgControlsModule } from '@videogular/ngx-videogular/controls';
import { VgOverlayPlayModule } from '@videogular/ngx-videogular/overlay-play';
import { VgBufferingModule } from '@videogular/ngx-videogular/buffering';
import { VideoUploadDialogComponent } from 'src/app/components/videos/video-upload-dialog/video-upload-dialog.component';
import { MediaListComponent } from 'src/app/components/media-list/media-list.component';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';
import { VideoPlayerComponent } from 'src/app/components/video-player/video-player.component';

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    ContactsComponent,
    CalendarComponent,
    PhotosComponent,
    EditContactComponent,
    ViewContactComponent,
    ChatComponent,
    ChatViewComponent,
    ChatEditComponent,
    CalendarDialogComponent,
    CalendarPrinterComponent,
    CalendarViewComponent,
    CalendarCellComponent,
    AdminComponent,
    PhotoUploadProgressComponent,
    ConfirmPromptComponent,
    FileInputComponent,
    VideosComponent,
    VideoUploadDialogComponent,
    MediaListComponent,
    MediaExplorerComponent,
    VideoPlayerComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FilterPipeModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    InfiniteScrollModule,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    AngularFireModule.initializeApp(secrets.firebaseConfig),
    AngularFireDatabaseModule,
    AngularFireStorageModule,
    AngularFireAuthModule,
    FirebaseUIModule.forRoot(AuthConfig),
    FontAwesomeModule,
    VgCoreModule,
    VgControlsModule,
    VgOverlayPlayModule,
    VgBufferingModule,
  ],
  providers: [
    { provide: LocationStrategy, useClass: PathLocationStrategy },
  ],
  bootstrap: [
    AppComponent,
  ],
  entryComponents: [
    CalendarDialogComponent,
    ConfirmPromptComponent,
    CalendarPrinterComponent,
  ],
  exports: [
    EditContactComponent,
  ]
})
export class AppModule { }
