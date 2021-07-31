import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthComponent } from 'src/app/components/auth/auth.component';
import { ChatComponent } from 'src/app/components/chat/chat.component';
import { ContactsComponent } from 'src/app/components/contacts/contacts.component';
import { CalendarComponent } from 'src/app/components/calendar/calendar.component';
import { PhotosComponent } from 'src/app/components/photos/photos.component';
import { AdminComponent } from 'src/app/components/admin/admin.component';
import { AuthGuardService } from 'src/app/services/auth-guard.service';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';

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
      path: 'media',
      component: MediaExplorerComponent,
      canActivate: [AuthGuardService],
    },
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
