import { Component, OnInit } from '@angular/core';
import { ChatViewComponent } from 'src/app/components/chat-view/chat-view.component';

@Component({
  selector: 'app-expression-view',
  templateUrl: './expression-view.component.html',
  styleUrls: ['./expression-view.component.scss']
})
export class ExpressionViewComponent extends ChatViewComponent implements OnInit {
  // Inherits the functionality as messages
  // Maintained as a separate component for templating purposes
}
