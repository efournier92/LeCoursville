import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { MaterialModule } from './material.module';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { CalendarComponent } from './components/calendar/calendar.component';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';
import { PhotosComponent } from './components/photos/photos.component';
import { AngularFireModule } from '@angular/fire';
import { AngularFireStorageModule } from '@angular/fire/storage';

@NgModule({
  declarations: [
    AppComponent,
    CalendarComponent,
    PhotosComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    PdfViewerModule,
    HttpClientModule,
    MaterialModule,
    AngularFireModule.initializeApp({
      apiKey: "AIzaSyDiFBDNhPId9SaEfIujumkGSySrs5vFAh4",
      authDomain: "lecoursville.firebaseapp.com",
      databaseURL: "https://lecoursville.firebaseio.com",
      projectId: "lecoursville",
      storageBucket: "lecoursville.appspot.com",
      messagingSenderId: "346526681784",
    }),
    AngularFireStorageModule,
  ],
  providers: [
    { provide: LocationStrategy, useClass: PathLocationStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
