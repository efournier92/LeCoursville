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
import { AdminFeaturesComponent } from './components/admin-features/admin-features.component';
import { FeatureDisabledComponent } from './components/feature-disabled/feature-disabled.component';
import { MediaExplorerComponent } from 'src/app/components/media-explorer/media-explorer.component';
import { MediaAudioComponent } from 'src/app/components/media-audio/media-audio.component';
import { MediaVideoComponent } from './components/media-video/media-video.component';
import { AuthAdminGuardService } from './services/auth-admin-guard.service';
import { FeatureFlagGuard } from './services/feature-flag-guard.service';
import { ExpressionsComponent } from './components/expressions/expressions.component';
import { PeopleComponent } from './components/people/people.component';
import { AdminPeopleImportComponent } from './components/admin-people-import/admin-people-import.component';
import { AdminClansComponent } from './components/admin-clans/admin-clans.component';

const routes: Routes =
  [
    {
      path: '',
      component: AuthComponent,
    },
    {
      path: 'contacts',
      component: ContactsComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'contacts' },
    },
    {
      path: 'calendar',
      component: CalendarComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'calendar' },
    },
    {
      path: 'chat',
      component: ChatComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'chat' },
    },
    {
      path: 'expressions',
      component: ExpressionsComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'expressions' },
    },
    {
      path: 'photos',
      component: PhotosComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'photos' },
    },
    // PEOPLE
    {
      path: 'people',
      component: PeopleComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'people' },
    },
    {
      path: 'contacts/:id',
      component: ContactsComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
    },
    // MEDIA
    {
      path: 'media/explorer',
      component: MediaExplorerComponent,
    },
    {
      path: 'media/audio',
      component: MediaAudioComponent,
      canActivate: [FeatureFlagGuard],
      data: { featureId: 'music' },
    },
    {
      path: 'media/video',
      component: MediaVideoComponent,
      canActivate: [FeatureFlagGuard],
      data: { featureId: 'videos' },
    },
    // ADMIN
    {
      path: 'admin',
      component: AdminComponent,
      canActivate: [AuthAdminGuardService],
      children: [
        {
          path: 'calendar',
          component: AdminCalendarComponent,
        },
        {
          path: 'media',
          component: AdminMediaComponent,
        },
        {
          path: 'users',
          component: AdminUsersComponent,
        },
        {
          path: 'features',
          component: AdminFeaturesComponent,
        },
        {
          path: 'people',
          component: AdminPeopleImportComponent,
        },
        {
          path: 'clans',
          component: AdminClansComponent,
        },
        {
          path: '',
          redirectTo: 'users',
          pathMatch: 'full'
        },
      ]
    },
    {
      path: 'feature-disabled',
      component: FeatureDisabledComponent,
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