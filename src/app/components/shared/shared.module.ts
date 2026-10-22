import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContactInfoComponent } from 'src/app/components/contact-info/contact-info.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { MediaListComponent } from 'src/app/components/media-list/media-list.component';
import { NoResultsMessageComponent } from 'src/app/components/no-results-message/no-results-message.component';
import { PersonDetailModalComponent } from 'src/app/components/person-detail-modal/person-detail-modal.component';
import { MaterialModule } from 'src/app/modules/material.module';
import { PersonTreeComponent } from './person-tree/person-tree.component';

/**
 * Declarations shared by the eager shell, the lazy calendar route and the lazy
 * media routes. Keeping them in one module lets all three consumers import the
 * same component instances instead of redeclaring them.
 */
@NgModule({
  declarations: [
    ContactInfoComponent,
    MediaListComponent,
    PersonDetailModalComponent,
    PersonTreeComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    LvLoadErrorComponent,
    NoResultsMessageComponent,
  ],
  exports: [
    ContactInfoComponent,
    MediaListComponent,
    PersonDetailModalComponent,
    PersonTreeComponent,
  ],
})
export class SharedModule {}
