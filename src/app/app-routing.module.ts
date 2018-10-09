import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthComponent } from './components/auth/auth.component';
import { ChatComponent } from 'src/app/components/chat/chat.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { PhotosComponent } from './components/photos/photos.component';

const routes : Routes =
  [
    {
      path: '',
      component: AuthComponent,
    },
    {
      path: 'chat',
      component: ChatComponent,
    },
    {
      path: 'contacts',
      component: ContactsComponent,
    },
    {
      path: 'calendar',
      component: CalendarComponent,
    },
    {
      path: 'photos',
      component: PhotosComponent,
    },

  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
