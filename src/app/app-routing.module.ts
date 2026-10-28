import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthActionComponent } from 'src/app/components/auth-action/auth-action.component';
import { AuthComponent } from 'src/app/components/auth/auth.component';
import { ChatComponent } from 'src/app/components/chat/chat.component';
import { ContactsComponent } from 'src/app/components/contacts/contacts.component';
import { PhotoShellComponent } from 'src/app/components/photo-shell/photo-shell.component';
import { PhotoAlbumDetailComponent } from 'src/app/components/photo-album-detail/photo-album-detail.component';
import { PhotoSlideshowComponent } from 'src/app/components/photo-slideshow/photo-slideshow.component';
import { AuthGuardService } from 'src/app/services/auth-guard.service';
import { FeatureDisabledComponent } from './components/feature-disabled/feature-disabled.component';
import { AuthAdminGuardService } from './services/auth-admin-guard.service';
import { FeatureFlagGuard } from './services/feature-flag-guard.service';
import { PhotoAlbumsFeatureGuard } from './services/photo-albums-feature.guard';
import { ExpressionsComponent } from './components/expressions/expressions.component';
import { PeopleComponent } from './components/people/people.component';
import { PublicUploadComponent } from './components/public-upload/public-upload.component';
import { SuperAdminGuard } from './services/super-admin.guard';

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
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'calendar' },
      loadChildren: () => import('./components/calendar/calendar.module').then(m => m.CalendarFeatureModule),
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
      component: PhotoShellComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'photos' },
    },
    {
      path: 'photos/:albumId',
      component: PhotoAlbumDetailComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard, PhotoAlbumsFeatureGuard],
      data: { featureId: 'photos', fallbackUrl: '/photos' },
    },
    {
      path: 'photos/:albumId/slideshow',
      component: PhotoSlideshowComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard, PhotoAlbumsFeatureGuard],
      data: { featureId: 'photos', fallbackUrl: '/photos' },
    },
    // PEOPLE
    {
      path: 'people',
      component: PeopleComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'people' },
    },
    // FAMILY ARCHIVES
    {
      path: 'families/:familyId',
      canActivate: [AuthGuardService, FeatureFlagGuard],
      data: { featureId: 'families' },
      loadChildren: () => import('./components/families/families.module').then(m => m.FamiliesModule),
    },
    {
      path: 'contacts/:id',
      component: ContactsComponent,
      canActivate: [AuthGuardService, FeatureFlagGuard],
    },
    // MEDIA
    {
      path: 'media',
      loadChildren: () => import('./components/media/media.module').then(m => m.MediaFeatureModule),
    },
    // ADMIN
    {
      path: 'admin',
      canActivate: [AuthAdminGuardService, SuperAdminGuard],
      loadChildren: () => import('./components/admin/admin.module').then(m => m.AdminModule),
    },
    {
      path: 'feature-disabled',
      component: FeatureDisabledComponent,
    },
    // PUBLIC UPLOAD
    {
      path: 'upload',
      component: PublicUploadComponent,
    },
    {
      path: 'auth/action',
      component: AuthActionComponent,
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