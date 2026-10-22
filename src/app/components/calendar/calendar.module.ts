import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarCellComponent } from 'src/app/components/calendar-cell/calendar-cell.component';
import { CalendarDatepickerDialogComponent } from 'src/app/components/calendar-datepicker-dialog/calendar-datepicker-dialog.component';
import { CalendarPrinterComponent } from 'src/app/components/calendar-printer/calendar-printer.component';
import { CalendarViewComponent } from 'src/app/components/calendar-view/calendar-view.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { SharedModule } from 'src/app/components/shared/shared.module';
import { MaterialModule } from 'src/app/modules/material.module';
import { CalendarComponent } from './calendar.component';

const routes: Routes = [
  {
    path: '',
    component: CalendarComponent,
  },
];

@NgModule({
  declarations: [
    CalendarComponent,
    CalendarViewComponent,
    CalendarCellComponent,
    CalendarDatepickerDialogComponent,
    CalendarPrinterComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule.forChild(routes),
    SharedModule,
    LvLoadErrorComponent,
    PageToolbarComponent,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
  ],
})
export class CalendarFeatureModule {}
