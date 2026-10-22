import { Component, Input, ChangeDetectionStrategy } from '@angular/core';


@Component({
    selector: 'app-page-toolbar',
    templateUrl: './page-toolbar.component.html',
    styleUrls: ['./page-toolbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: []
})
export class PageToolbarComponent {
  @Input() title: string | null = null;
}