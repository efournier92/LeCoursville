import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MessageViewComponent } from 'src/app/components/message-view/message-view.component';

@Component({
    selector: 'app-expression-view',
    templateUrl: './expression-view.component.html',
    styleUrls: ['./expression-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExpressionViewComponent extends MessageViewComponent {
  // Inherits functionality from messages
  // Maintained as a separate component for templating purposes
}
