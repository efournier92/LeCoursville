import { secrets } from '../environments/secrets.js';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';
import { FilterPipeModule } from 'ngx-filter-pipe';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { AngularFireModule } from '@angular/fire';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFireDatabaseModule } from '@angular/fire/database';
import { FirebaseUIModule } from 'firebaseui-angular';
import { AppRoutingModule } from './app-routing.module';
import { MaterialModule } from './material/material.module';
import { AuthConfig } from './auth.config'
import { AppComponent } from './app.component';
import { AuthComponent } from './auth/auth.component';
import { ContactsComponent } from './contacts/contacts.component';
import { CalendarComponent } from './calendar/calendar.component';
import { PhotosComponent } from './photos/photos.component';
import { EditContactComponent } from './contacts/edit-contact/edit-contact.component';
import { ViewContactComponent } from './contacts/view-contact/view-contact.component';
import { ChatComponent } from './chat/chat.component';
import { ChatViewComponent } from './chat/chat-view/chat-view.component';
import { ChatEditComponent } from './chat/chat-edit/chat-edit.component';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarDialogComponent } from './calendar/calendar-dialog/calendar-dialog.component';
import { CalendarPrinterComponent } from './calendar/calendar-printer/calendar-printer.component';
import { CalendarViewComponent } from './calendar/calendar-view/calendar-view.component';
import { CalendarCellComponent } from './calendar/calendar-view/calendar-cell/calendar-cell.component';
import { AdminComponent } from './admin/admin.component';
import { PhotoUploadProgressComponent } from './photos/photo-upload-progress/photo-upload-progress.component';
import { ConfirmPromptComponent } from './confirm-prompt/confirm-prompt.component';
import { FileInputComponent } from './file-input/file-input.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { VideosComponent } from './videos/videos.component';

import {VgCoreModule} from '@videogular/ngx-videogular/core';
import {VgControlsModule} from '@videogular/ngx-videogular/controls';
import {VgOverlayPlayModule} from '@videogular/ngx-videogular/overlay-play';
import {VgBufferingModule} from '@videogular/ngx-videogular/buffering';

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
    PdfViewerModule,
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
