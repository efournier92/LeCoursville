import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { ADMIN_ROUTE } from 'src/app/admin/admin-nav';
import { AdminMediaComponent } from 'src/app/components/admin-media/admin-media.component';
import { AdminContactsComponent } from 'src/app/components/admin-contacts/admin-contacts.component';
import { ExpressionsComponent } from 'src/app/components/expressions/expressions.component';
import { AdminPhotoAlbumsComponent } from 'src/app/components/admin-photo-albums/admin-photo-albums.component';
import { AdminUserUploadsComponent } from 'src/app/components/admin-user-uploads/admin-user-uploads.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { NoResultsMessageComponent } from 'src/app/components/no-results-message/no-results-message.component';
import { AdminFilterBarComponent } from 'src/app/components/shared/admin-filter-bar/admin-filter-bar.component';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { MaterialModule } from 'src/app/modules/material.module';
import { PhotoAlbumsFeatureGuard } from 'src/app/services/photo-albums-feature.guard';
import { AdminComponent } from './admin.component';
import { AdminCalendarsComponent } from '../admin-calendars/admin-calendars.component';
import { AdminFamiliesComponent } from '../admin-families/admin-families.component';
import { AdminFamilyExplorerComponent } from '../admin-family-explorer/admin-family-explorer.component';
import { AdminFeaturesComponent } from '../admin-features/admin-features.component';
import { AdminPeopleImportComponent } from '../admin-people-import/admin-people-import.component';
import { AdminRecoveryComponent } from '../admin-recovery/admin-recovery.component';
import { AdminUsersComponent } from '../admin-users/admin-users.component';

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
        component: AdminPhotoAlbumsComponent,
        canActivate: [PhotoAlbumsFeatureGuard],
        data: { fallbackUrl: '/admin' },
      },
      {
        path: ADMIN_ROUTE.users,
        component: AdminUsersComponent,
      },
      {
        path: ADMIN_ROUTE.features,
        component: AdminFeaturesComponent,
      },
      {
        path: ADMIN_ROUTE.people,
        component: AdminPeopleImportComponent,
      },
      {
        // Contact fixups after CSV import. AdminContactsComponent is declared
        // in AppModule so it can embed ContactEditComponent (same pattern as
        // AdminMedia: routed here, declared eagerly).
        path: ADMIN_ROUTE.contacts,
        component: AdminContactsComponent,
      },
      {
        path: ADMIN_ROUTE.contacts + '/:id',
        component: AdminContactsComponent,
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
      },
      {
        path: ADMIN_ROUTE.uploads,
        component: AdminUserUploadsComponent,
      },
      {
        path: ADMIN_ROUTE.recovery,
        component: AdminRecoveryComponent,
      },
      {
        path: '',
        redirectTo: 'users',
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
    AdminFamiliesComponent,
    AdminCalendarsComponent,
    AdminFamilyExplorerComponent,
    AdminRecoveryComponent,
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
  ],
})
export class AdminModule {}
