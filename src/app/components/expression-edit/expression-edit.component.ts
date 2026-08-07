import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ChatEditComponent } from 'src/app/components/chat-edit/chat-edit.component';

@Component({
    selector: 'app-expression-edit',
    templateUrl: './expression-edit.component.html',
    styleUrls: ['./expression-edit.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExpressionEditComponent extends ChatEditComponent {
  // Inherits functionality from messages
  // Maintained as a separate component for templating purposes
}
