import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';
import { FilterPipeModule } from 'ngx-filter-pipe';
import { FormsModule } from '@angular/forms';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';

import { AngularFireModule } from '@angular/fire';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFireDatabaseModule } from '@angular/fire/database';
import { FirebaseUIModule } from 'firebaseui-angular';

import { AppRoutingModule } from './app-routing.module';
import { MaterialModule } from './material.module';
import { AuthConfig } from './auth.config'
import { AppComponent } from './app.component';
import { AuthComponent } from './components/auth/auth.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { PhotosComponent } from './components/photos/photos.component';
import { EditContactComponent } from './components/contacts/edit-contact/edit-contact.component';
import { ViewContactComponent } from './components/contacts/view-contact/view-contact.component';
import { ChatComponent } from './components/chat/chat.component';
import { NamePrompt } from './components/auth/name-prompt/name-prompt';
import { ViewChatComponent } from './components/chat/view-chat/view-chat.component';
import { EditChatComponent } from './components/chat/edit-chat/edit-chat.component';
import { AngularFontAwesomeModule } from 'angular-font-awesome';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarDialogComponent } from './components/calendar/calendar-dialog/calendar-dialog.component';
import { CalendarPrinterComponent } from './components/calendar/calendar-printer/calendar-printer.component';
import { CalendarViewComponent } from './components/calendar/calendar-view/calendar-view.component';
import { CalendarCellComponent } from './components/calendar/calendar-view/calendar-cell/calendar-cell.component';

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
    NamePrompt,
    ViewChatComponent,
    EditChatComponent,
    CalendarDialogComponent,
    CalendarPrinterComponent,
    CalendarViewComponent,
    CalendarCellComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FilterPipeModule,
    FormsModule,
    MaterialModule,
    PdfViewerModule,
    AngularFontAwesomeModule,
    InfiniteScrollModule,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    AngularFireModule.initializeApp({
      apiKey: "AIzaSyDiFBDNhPId9SaEfIujumkGSySrs5vFAh4",
      authDomain: "lecoursville.firebaseapp.com",
      databaseURL: "https://lecoursville.firebaseio.com",
      projectId: "lecoursville",
      storageBucket: "lecoursville.appspot.com",
      messagingSenderId: "346526681784",
    }),
    AngularFireDatabaseModule,
    AngularFireStorageModule,
    AngularFireAuthModule,
    FirebaseUIModule.forRoot(AuthConfig),
  ],
  providers: [
    { provide: LocationStrategy, useClass: PathLocationStrategy },
  ],
  bootstrap: [
    AppComponent,
  ],
  entryComponents: [
    NamePrompt,
    CalendarDialogComponent,
  ],
  exports: [
    EditContactComponent,
  ]
})

export class AppModule { }
