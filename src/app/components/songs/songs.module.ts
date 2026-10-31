import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { NoResultsMessageComponent } from 'src/app/components/no-results-message/no-results-message.component';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { SharedModule } from 'src/app/components/shared/shared.module';
import { MaterialModule } from 'src/app/modules/material.module';
import { SongDetailComponent } from './song-detail.component';
import { SongsListComponent } from './songs-list.component';

const routes: Routes = [
  {
    path: '',
    component: SongsListComponent,
  },
  {
    path: ':id',
    component: SongDetailComponent,
  },
];

@NgModule({
  declarations: [
    SongsListComponent,
    SongDetailComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule.forChild(routes),
    SharedModule,
    LvLoadErrorComponent,
    NoResultsMessageComponent,
    PageToolbarComponent,
  ],
})
export class SongsFeatureModule {}
