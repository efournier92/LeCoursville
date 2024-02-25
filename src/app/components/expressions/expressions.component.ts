import { Component, OnInit } from '@angular/core';
import { MessageComponent } from 'src/app/components/message/message.component';
import { Expression } from 'src/app/models/expression';
import { ExpressionConstants } from 'src/app/constants/expression-constants';
import { MessageConstants } from 'src/app/constants/message-constants';

@Component({
  selector: 'app-expressions',
  templateUrl: './expressions.component.html',
  styleUrls: ['./expressions.component.scss']
})
export class ExpressionsComponent extends MessageComponent {
  expressions: Expression[];
  headerText: string = ExpressionConstants.HeaderText;
  headerAttribution: string = ExpressionConstants.HeaderAttribution;
  isLoading: boolean = true;
  messageType: string = MessageConstants.Types.Expression;

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    super.ngOnInit();
  }

  // PUBLIC METHODS

  create(): void {
    for (const expression of this.expressions) {
      if (expression.isEditable === true) { return; }
    }
    const authorId: string = this.user.id;
    this.expressions.unshift(new Expression(true))
    this.analyticsService.logEvent('expression_create', {
      userId: this.user?.id,
    });
  }

  onMessagesObservableUpdate(expressions: Expression[]): void {
    expressions = this.messageService.filterByType(expressions, MessageConstants.Types.Expression);

    if (expressions.length) {
      // Hide initial sorting process from UI
      setTimeout(() => {
        this.isLoading = false
      }, 500);
    }

    expressions = this.arrayService.shuffle(expressions);

    this.expressions =expressions
  }
}
