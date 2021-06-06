import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { PhotosComponent } from './photos/photos.component';
import { AuthComponent } from './auth/auth.component';
//import { CalendarComponent } from './calendar/calendar.component';
import { ChatComponent } from './chat/chat.component';
import { ConfirmPromptComponent } from './confirm-prompt/confirm-prompt.component';
import { ContactsComponent } from './contacts/contacts.component';
import { FileInputComponent } from './file-input/file-input.component';
import { AdminComponent } from './admin/admin.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';

import { MaterialModule } from './material.module';

@NgModule({
  declarations: [
    AppComponent,
    PhotosComponent,
    AuthComponent,
    //CalendarComponent,
    ChatComponent,
    ConfirmPromptComponent,
    ContactsComponent,
    FileInputComponent,
    AdminComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MaterialModule,
    BrowserAnimationsModule,
    FormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
