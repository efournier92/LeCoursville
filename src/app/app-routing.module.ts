import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthComponent } from 'src/app/auth/auth.component';
import { ChatComponent } from 'src/app/chat/chat.component';
import { ContactsComponent } from 'src/app/contacts/contacts.component';
import { CalendarComponent } from 'src/app/calendar/calendar.component';
import { PhotosComponent } from 'src/app/photos/photos.component';
import { VideosComponent } from 'src/app/videos/videos.component';
// import { StoriesComponent } from 'src/app/stories/stories.component';
import { AdminComponent } from 'src/app/admin/admin.component';
import { AuthGuardService } from 'src/app/auth/auth-guard.service';

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
      path: 'videos',
      component: VideosComponent,
      canActivate: [AuthGuardService],
    },
    // {
    //   path: 'stories',
    //   component: StoriesComponent,
    //   canActivate: [AuthGuardService],
    // },
    {
      path: 'admin',
      component: AdminComponent,
      canActivate: [AuthGuardService],
    },
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }

