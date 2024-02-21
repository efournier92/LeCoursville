import { Component, OnInit } from '@angular/core';
import { ChatEditComponent } from 'src/app/components/chat-edit/chat-edit.component';

@Component({
  selector: 'app-expression-edit',
  templateUrl: './expression-edit.component.html',
  styleUrls: ['./expression-edit.component.scss']
})
export class ExpressionEditComponent extends ChatEditComponent implements OnInit {
  // Inherits the functionality as messages
  // Maintained as a separate component for templating purposes
}
