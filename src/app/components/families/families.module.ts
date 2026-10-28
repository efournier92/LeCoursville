import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from 'src/app/modules/material.module';
import { FamilyArchiveComponent } from './family-archive.component';
import { FamilyChartComponent } from './family-chart.component';
import { FamilyPanelComponent } from './family-panel.component';

const routes: Routes = [
  {
    path: '',
    component: FamilyArchiveComponent,
  },
];

@NgModule({
  declarations: [FamilyArchiveComponent, FamilyChartComponent, FamilyPanelComponent],
  imports: [CommonModule, FormsModule, MaterialModule, RouterModule.forChild(routes)],
})
export class FamiliesModule {}
