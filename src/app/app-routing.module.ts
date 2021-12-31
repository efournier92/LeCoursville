import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthComponent } from 'src/app/components/auth/auth.component';
import { ChatComponent } from 'src/app/components/chat/chat.component';
import { ContactsComponent } from 'src/app/components/contacts/contacts.component';
import { CalendarComponent } from 'src/app/components/calendar/calendar.component';
import { PhotosComponent } from 'src/app/components/photos/photos.component';
import { AdminComponent } from 'src/app/components/admin/admin.component';
import { AuthGuardService } from 'src/app/services/auth-guard.service';
import { AdminCalendarComponent } from './components/admin-calendar/admin-calendar.component';
import { AdminMediaComponent } from './components/admin-media/admin-media.component';
import { AdminUsersComponent } from './components/admin-users/admin-users.component';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';
import { MediaAudioComponent } from 'src/app/components/media-audio/media-audio.component';
import { MediaVideoComponent } from './components/media-video/media-video.component';
import { AuthAdminGuardService } from './services/auth-admin-guard.service';

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
    // MEDIA
    {
      path: 'media/explorer',
      component: MediaExplorerComponent,
    },
    {
      path: 'media/audio',
      component: MediaAudioComponent,
    },
    {
      path: 'media/video',
      component: MediaVideoComponent,
    },
    // ADMIN
    {
      path: 'admin',
      component: AdminComponent,
      canActivate: [AuthAdminGuardService],
    },
    {
      path: 'admin/calendar',
      component: AdminCalendarComponent,
      canActivate: [AuthAdminGuardService],
    },
    {
      path: 'admin/media',
      component: AdminMediaComponent,
      canActivate: [AuthAdminGuardService],
    },
    {
      path: 'admin/users',
      component: AdminUsersComponent,
      canActivate: [AuthAdminGuardService],
    },
    {
      path: '**',
      component: AuthComponent,
    },
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }
