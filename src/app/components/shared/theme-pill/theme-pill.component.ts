import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-theme-pill',
  templateUrl: './theme-pill.component.html',
  styleUrls: ['./theme-pill.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ThemePillComponent {
  @Input() mode: 'light' | 'dark' = 'light';
}
