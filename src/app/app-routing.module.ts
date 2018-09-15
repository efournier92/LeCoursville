import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CalendarComponent } from './components/calendar/calendar.component';

const routes : Routes =
  [
    {
      path: 'calendar',
      component: CalendarComponent,
    },
    {
      path: 'photos',
      component: CalendarComponent,
    },


    // {
    //   path: 'books',
    //   component: BooksComponent
    // },
    // {
    //   path: 'customers',
    //   component: CustomersComponent,
    // },
    // {
    //   path: 'loans',
    //   component: LoansComponent,
 
    // },
    // {
    //   path: '**',
    //   component: PageNotFoundComponent
    // }
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
