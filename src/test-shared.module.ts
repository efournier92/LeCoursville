import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/app/modules/material.module';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterTestingModule,
    NoopAnimationsModule,
    MaterialModule,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    NgxExtendedPdfViewerModule,
  ],
  exports: [
    CommonModule,
    FormsModule,
    RouterTestingModule,
    NoopAnimationsModule,
    MaterialModule,
    CalendarModule,
    NgxExtendedPdfViewerModule,
  ],
})
export class TestSharedModule {}
