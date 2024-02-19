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

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private analyticsService: AnalyticsService,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.analyticsService.logEvent('component_load_expressions', { });


    const title = 'Kissed His Bague';
    const body = '"Kissed his bague" has remained a true classic of an expression. The phrase originates from the French word for ring (\'bague\' may be the French spelling) and the custom of Roman Catholics to kiss the ring of a high ranking prelate of the Church. The expression has provoked more than a little amusement when deftly employed by some of the LeCoursville citizenry.';
    const authorName = 'Richard LeCours';
    const yearWritten = '1984';
    const attribution = 'Annette Miller';
    const type = 'expression';

    const expression = new Expression(title, body, authorName, yearWritten, attribution);
    this.expressions = [expression, expression]
    console.log('Expressions', this.expressions);
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
    const authorName: string = this.user.name;
    this.expressions.unshift(new Expression('', '', '', authorId, authorName));
    // TODO: Move to its own function
    this.analyticsService.logEvent('expression_create', {
      userId: this.user?.id,
    });
  }

  private subscribeToChatObservable(): void {
    this.chatService.chatObservable.subscribe(
      (messages: Expression[]) => {
        messages = this.filterExpressions(messages);
        // TODO: Randomize sorting
        // this.expressions = messages.sort(this.compareMessagesByTimestamp);
      }
    );
  }

  private filterExpressions(messages: Expression[]): Expression[] {
    const type = ExpressionConstants.Types.Expression

    return messages.filter(message => message.messageType === type);
  }
}
