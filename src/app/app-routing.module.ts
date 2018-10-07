import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CalendarComponent } from './components/calendar/calendar.component';
import { PhotosComponent } from './components/photos/photos.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { AuthComponent } from './components/auth/auth.component';

const routes : Routes =
  [
    {
      path: '',
      component: AuthComponent,
    },
    {
      path: 'calendar',
      component: CalendarComponent,
    },
    {
      path: 'photos',
      component: PhotosComponent,
    },
    {
      path: 'contacts',
      component: ContactsComponent,
    },
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
