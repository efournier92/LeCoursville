import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthComponent } from './components/auth/auth.component';
import { ChatComponent } from 'src/app/components/chat/chat.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { PhotosComponent } from './components/photos/photos.component';
import { StoriesComponent } from './components/stories/stories.component';
import { AuthGuardService } from './components/auth/auth-guard.service';

const routes: Routes =
  [
    {
      path: '',
      component: AuthComponent,
    },
    {
      path: 'contacts',
      component: ContactsComponent,
      canActivate: [AuthGuardService],
    },
    {
      path: 'calendar',
      component: CalendarComponent,
      canActivate: [AuthGuardService],
    },
    {
      path: 'chat',
      component: ChatComponent,
      canActivate: [AuthGuardService],
    },
    {
      path: 'photos',
      component: PhotosComponent,
      canActivate: [AuthGuardService],
    },
    {
      path: 'stories',
      component: StoriesComponent,
      canActivate: [AuthGuardService],
    },
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
