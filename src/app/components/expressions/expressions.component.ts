import { Component, OnInit } from '@angular/core';
import { MessageComponent } from 'src/app/components/message/message.component';
import { Expression } from 'src/app/models/expression';
import { ExpressionConstants } from 'src/app/constants/expression-constants';
import { MessageConstants } from 'src/app/constants/message-constants';
import { SortSettingsForExpressions } from 'src/app/models/sort-settings-for-expressions';

@Component({
  selector: 'app-expressions',
  templateUrl: './expressions.component.html',
  styleUrls: ['./expressions.component.scss']
})
export class ExpressionsComponent extends MessageComponent {
  headerText: string = ExpressionConstants.HeaderText;
  headerAttribution: string = ExpressionConstants.HeaderAttribution;
  isLoading: boolean = true;
  messageType: string = MessageConstants.Types.Expression;
  sortSettings: SortSettingsForExpressions = new SortSettingsForExpressions();

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    super.ngOnInit();
  }

  // PUBLIC METHODS

  onCreate(): void {
    for (const expression of this.allItems) {
      if (expression.isEditable === true) { return; }
    }

    const authorId: string = this.user.id;

    this.displayedItems.unshift(new Expression(true, authorId));
    this.analyticsService.logEvent('expression_create', {
      userId: this.user?.id,
    });
  }

  onFilterQueryChange(query: string): void {
    this.sortSettings.activeFilterParams = {};
    this.sortSettings.activeFilterQuery = query;
    this.displayedItems = this.sortSettings.getItemsToDisplay(this.allItems);
  }

  onMessagesObservableUpdate(expressions: Expression[]): void {
    expressions = this.messageService.filterByType(expressions, MessageConstants.Types.Expression);

    if (expressions.length) {
      // Hide initial sorting process from UI
      setTimeout(() => {
        this.isLoading = false
      }, 500);
    }

    this.sortSettings.activeFilterParams = this.queryParams;

    this.allItems = expressions;
    this.displayedItems = this.sortSettings.getItemsToDisplay(this.allItems);
  }

  setSortProperty(activeSortProperty) {
    if (this.sortSettings.activeSortProperty === activeSortProperty)
      this.sortSettings.reverseSortDirection()

    this.sortSettings.activeSortProperty = activeSortProperty;
    this.displayedItems = this.sortSettings.getItemsToDisplay(this.allItems);
  }

  reverseSortDirection() {
    this.sortSettings.reverseSortDirection()
    this.displayedItems = this.displayedItems.reverse();
    console.log(`direction`, this.sortSettings.activeDirection);
  }

  filterByQueryParams() {
    console.log('Params', this.queryParams);
  }

  shouldDisplayShowAllButton(): boolean {
    return this.sortSettings.hasActiveFilterParams();
  }

  onShowAll() {
    this.sortSettings.activeFilterParams = {};
    this.displayedItems = this.sortSettings.getItemsToDisplay(this.allItems);
  }
}
