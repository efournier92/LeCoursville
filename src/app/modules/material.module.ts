import { NgModule } from '@angular/core';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

@NgModule({
  imports: [
    MatToolbarModule,
    MatSidenavModule,
    MatTabsModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatMenuModule,
    MatListModule,
    MatBadgeModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
  ],
  exports: [
    MatToolbarModule,
    MatSidenavModule,
    MatTabsModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatListModule,
    MatBadgeModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatAutocompleteModule,
  ],
})
export class MaterialModule { }
