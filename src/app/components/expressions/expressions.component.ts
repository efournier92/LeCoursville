import { Component, OnInit } from '@angular/core';
import { User } from 'src/app/models/user';
import { Message } from 'src/app/models/message';
import { AuthService } from 'src/app/services/auth.service';
import { ChatService } from 'src/app/services/chat.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { Expression } from 'src/app/models/expression';
import { ExpressionConstants } from 'src/app/constants/expression-constants';

@Component({
  selector: 'app-expressions',
  templateUrl: './expressions.component.html',
  styleUrls: ['./expressions.component.scss']
})
export class ExpressionsComponent implements OnInit {
  user: User;
  expressions: Expression[];
  headerText: string = ExpressionConstants.HeaderText;
  headerAttribution: string = ExpressionConstants.HeaderAttribution;
  isLoading: boolean = true;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private analyticsService: AnalyticsService,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.analyticsService.logEvent('component_load_expressions', { });
  }

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        this.subscribeToChatObservable();
      }
    );
  }

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

  updateMessages(message: Message): void {
    this.chatService.updateMessage(message);
  }

  cancelEdit(expression: Expression): void {
    if (!expression.isSaved) {
      this.expressions.shift();
    } else {
      expression.isEditable = false;
    }
    this.analyticsService.logEvent('chat_message_edit_cancel', {
      userId: this.user?.id,
    });
  }

  private subscribeToChatObservable(): void {
    this.chatService.chatObservable.subscribe(
      (expressions: Expression[]) => {
        this.onExpressionsChanged(expressions)
      }
    );
  }

  private onExpressionsChanged(expressions: Expression[]): void {
    expressions = this.filterExpressionType(expressions);

    if (expressions.length) {
      setTimeout(() => {
        this.isLoading = false
      }, 500);
    }

    expressions = this.shuffleArray(expressions);

    this.expressions =expressions
  }

  // TODO: Abstract with Expression type
  private filterExpressionType(expressions: Expression[]): Expression[] {
    const type = ExpressionConstants.Types.Expression

    return expressions.filter(message => message.messageType === type);
  }

  private shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * array.length);
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array
  }
}
