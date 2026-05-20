import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-no-results-message',
  templateUrl: './no-results-message.component.html',
  styleUrls: ['./no-results-message.component.scss']
})
export class NoResultsMessageComponent {
  @Input() searchTerm: string;
  @Input() isCentered = false;
}