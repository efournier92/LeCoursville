import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from 'src/app/modules/material.module';
import { SharedModule } from 'src/app/components/shared/shared.module';
import { NoResultsMessageComponent } from 'src/app/components/no-results-message/no-results-message.component';
import { FamilyExplorerComponent } from './family-explorer.component';
import { FamilyChartComponent } from './family-chart.component';
import { FamilyPanelComponent } from './family-panel.component';
import { FamilyTreeNodeComponent } from './family-tree-node.component';

const routes: Routes = [
  {
    path: '',
    component: FamilyExplorerComponent,
  },
];

@NgModule({
  declarations: [FamilyExplorerComponent, FamilyChartComponent, FamilyTreeNodeComponent, FamilyPanelComponent],
  imports: [CommonModule, FormsModule, MaterialModule, SharedModule, NoResultsMessageComponent, RouterModule.forChild(routes)],
})
export class FamilyExplorerModule {}
