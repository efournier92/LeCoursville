import { CommonModule } from '@angular/common';
import { NgModule, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, Routes, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarCellComponent } from 'src/app/components/calendar-cell/calendar-cell.component';
import { DismissOnOutsideDirective } from 'src/app/directives/dismiss-on-outside.directive';
import { CalendarDatepickerDialogComponent } from 'src/app/components/calendar-datepicker-dialog/calendar-datepicker-dialog.component';
import { CalendarPrintComponent } from 'src/app/components/calendar-print/calendar-print.component';
import { CalendarPrinterComponent } from 'src/app/components/calendar-printer/calendar-printer.component';
import { CalendarViewComponent } from 'src/app/components/calendar-view/calendar-view.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { SharedModule } from 'src/app/components/shared/shared.module';
import { MaterialModule } from 'src/app/modules/material.module';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { CalendarComponent, legacyCalendarPdfEnabled } from './calendar.component';

function calendarPrintGuard(): Observable<boolean | UrlTree> {
  const featureFlagsService = inject(FeatureFlagsService);
  const router = inject(Router);
  return legacyCalendarPdfEnabled(featureFlagsService).pipe(
    map(enabled => enabled ? router.createUrlTree(['/calendar']) : true),
  );
}

const routes: Routes = [
  {
    path: '',
    component: CalendarComponent,
  },
  {
    path: 'print',
    component: CalendarPrintComponent,
    canActivate: [calendarPrintGuard],
  },
];

@NgModule({
  declarations: [
    CalendarComponent,
    CalendarViewComponent,
    CalendarCellComponent,
    CalendarDatepickerDialogComponent,
    CalendarPrinterComponent,
    CalendarPrintComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule.forChild(routes),
    SharedModule,
    LvLoadErrorComponent,
    PageToolbarComponent,
    DismissOnOutsideDirective,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
  ],
})
export class CalendarFeatureModule {}
