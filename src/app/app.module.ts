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

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    ContactsComponent,
    CalendarComponent,
    PhotosComponent,
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
    InfiniteScrollModule,
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
    { provide: LocationStrategy, useClass: PathLocationStrategy }
  ],
  bootstrap: [
    AppComponent,
  ],
})

export class AppModule { }
