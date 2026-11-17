import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { MessageViewComponent } from 'src/app/components/message-view/message-view.component';
import { Message } from 'src/app/models/message';

@Component({
    selector: 'app-expression-view',
    templateUrl: './expression-view.component.html',
    styleUrls: ['./expression-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExpressionViewComponent extends MessageViewComponent {
  @Input() canEdit = false;
  @Output() editEvent = new EventEmitter<Message>();

  override editMessage(): void {
    this.editEvent.emit(this.message);
  }
}
