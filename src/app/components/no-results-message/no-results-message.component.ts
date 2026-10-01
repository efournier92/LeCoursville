import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-no-results-message',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './no-results-message.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./no-results-message.component.scss']
})
export class NoResultsMessageComponent {
  @Input() searchTerm: string;
  @Input() isCentered = false;
  /** What was searched, e.g. 'albums' → "No albums match …" (default: the
   *  original people/contacts phrasing). */
  @Input() noun: string;
  /** Custom empty-library copy when there is no search term. */
  @Input() hint = 'Try a first name, a last name, or a family.';
  @Input() title = 'Nothing found';
}