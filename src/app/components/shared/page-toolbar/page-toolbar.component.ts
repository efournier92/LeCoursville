import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-toolbar',
  standalone: true,
  templateUrl: './page-toolbar.component.html',
  styleUrls: ['./page-toolbar.component.scss'],
  imports: [CommonModule],
})
export class PageToolbarComponent {
  @Input() title: string | null = null;
}