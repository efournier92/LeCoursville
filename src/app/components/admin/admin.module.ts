import { CommonModule } from '@angular/common';
import { NgModule, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CanActivateFn, Router, RouterModule, Routes } from '@angular/router';
import { ADMIN_ROUTE } from 'src/app/admin/admin-nav';
import { AdminMediaComponent } from 'src/app/components/admin-media/admin-media.component';
import { ExpressionsComponent } from 'src/app/components/expressions/expressions.component';
import { AdminUserUploadsComponent } from 'src/app/components/admin-user-uploads/admin-user-uploads.component';
import { AdminAnalyticsComponent } from 'src/app/components/admin-analytics/admin-analytics.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { NoResultsMessageComponent } from 'src/app/components/no-results-message/no-results-message.component';
import { AdminFilterBarComponent } from 'src/app/components/shared/admin-filter-bar/admin-filter-bar.component';
import { SharedModule } from 'src/app/components/shared/shared.module';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { MaterialModule } from 'src/app/modules/material.module';
import { PhotoAlbumsFeatureGuard } from 'src/app/services/photo-albums-feature.guard';
import { SuperAdminGuard } from 'src/app/services/super-admin.guard';
import { AdminComponent } from './admin.component';
import { AdminCalendarsComponent } from '../admin-calendars/admin-calendars.component';
import { AdminDataRequestsComponent } from '../admin-data-requests/admin-data-requests.component';
import { AdminFamiliesComponent } from '../admin-families/admin-families.component';
import { AdminFamilyExplorerComponent } from '../admin-family-explorer/admin-family-explorer.component';
import { AdminFeaturesComponent } from '../admin-features/admin-features.component';
import { AdminPeopleImportComponent } from '../admin-people-import/admin-people-import.component';
import { AdminPeopleComponent } from '../admin-people/admin-people.component';
import { AdminRecoveryComponent } from '../admin-recovery/admin-recovery.component';
import { AdminSongsComponent } from '../admin-songs/admin-songs.component';
import { AdminUsersComponent } from '../admin-users/admin-users.component';
import { SongDraftDialogComponent } from '../song-draft-dialog/song-draft-dialog.component';

// Legacy links open the Media photo-albums tab with a URL that matches it.
const redirectPhotoAlbums: CanActivateFn = () =>
  inject(Router).createUrlTree(['/admin/media'], { queryParams: { section: 'photo-albums' } });

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: ADMIN_ROUTE.media,
        // AdminMedia and its upload tabs stay in AppModule: their shared
        // MediaListComponent is declared eagerly for the media-explorer route.
        component: AdminMediaComponent,
      },
      {
        path: ADMIN_ROUTE.photoAlbums,
        // Compatibility route: media is the only surface, with the Photo Albums
        // section selected. Old links and tests no longer 404. An empty
        // `children` keeps the dev-mode route validator happy: this route
        // always redirects from `canActivate`, but Angular still requires one of
        // component/loadComponent/redirectTo/children/loadChildren (NG04014),
        // and `redirectTo` cannot combine with `canActivate`.
        canActivate: [PhotoAlbumsFeatureGuard, redirectPhotoAlbums],
        data: { fallbackUrl: '/admin' },
        children: [],
      },
      {
        path: ADMIN_ROUTE.songs,
        component: AdminSongsComponent,
      },
      {
        path: ADMIN_ROUTE.users,
        component: AdminUsersComponent,
        canActivate: [SuperAdminGuard],
      },
      {
        path: ADMIN_ROUTE.features,
        component: AdminFeaturesComponent,
        canActivate: [SuperAdminGuard],
      },
      {
        path: ADMIN_ROUTE.people,
        component: AdminPeopleComponent,
      },
      {
        // Expressions reuse: the member route stays read-only; admin
        // create/edit lives here via route-aware controls.
        path: ADMIN_ROUTE.expressions,
        component: ExpressionsComponent,
      },
      {
        path: ADMIN_ROUTE.families,
        component: AdminFamiliesComponent,
      },
      {
        path: ADMIN_ROUTE.calendars,
        component: AdminCalendarsComponent,
      },
      {
        path: ADMIN_ROUTE.familyExplorer,
        component: AdminFamilyExplorerComponent,
        canActivate: [SuperAdminGuard],
      },
      {
        path: ADMIN_ROUTE.uploads,
        component: AdminUserUploadsComponent,
        canActivate: [SuperAdminGuard],
      },
      {
        path: ADMIN_ROUTE.recovery,
        component: AdminRecoveryComponent,
        canActivate: [SuperAdminGuard],
      },
      {
        path: ADMIN_ROUTE.dataRequests,
        component: AdminDataRequestsComponent,
      },
      {
        path: ADMIN_ROUTE.analytics,
        component: AdminAnalyticsComponent,
        canActivate: [SuperAdminGuard],
      },
      {
        path: '',
        redirectTo: ADMIN_ROUTE.families,
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  declarations: [
    AdminComponent,
    AdminUsersComponent,
    AdminFeaturesComponent,
    AdminPeopleImportComponent,
    AdminPeopleComponent,
    AdminFamiliesComponent,
    AdminCalendarsComponent,
    AdminFamilyExplorerComponent,
    AdminRecoveryComponent,
    AdminSongsComponent,
    SongDraftDialogComponent,
    AdminAnalyticsComponent,
    AdminDataRequestsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule.forChild(routes),
    LvLoadErrorComponent,
    NoResultsMessageComponent,
    PageToolbarComponent,
    AdminFilterBarComponent,
    SharedModule,
  ],
})
export class AdminModule {}
