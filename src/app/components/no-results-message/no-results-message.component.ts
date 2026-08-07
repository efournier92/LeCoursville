import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-no-results-message',
  standalone: true,
  templateUrl: './no-results-message.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./no-results-message.component.scss']
})
export class NoResultsMessageComponent {
  @Input() searchTerm: string;
  @Input() isCentered = false;
}