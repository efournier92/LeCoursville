import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MessageComponent } from 'src/app/components/message/message.component';
import { Expression } from 'src/app/models/expression';
import { ExpressionConstants } from 'src/app/constants/expression-constants';
import { MessageConstants } from 'src/app/constants/message-constants';
import { SortSettingsForExpressions } from 'src/app/models/sort-settings-for-expressions';
import { SortProperty } from 'src/app/models/sort-settings';

@Component({
    selector: 'app-expressions',
    templateUrl: './expressions.component.html',
    styleUrls: ['./expressions.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExpressionsComponent extends MessageComponent implements OnInit {
  headerQuoteText: string = ExpressionConstants.HeaderQuoteText;
  headerAttributionText: string = ExpressionConstants.HeaderAttributionText;
  isLoading: boolean = true;
  messageType: string = MessageConstants.Types.Expression;
  sortSettings: SortSettingsForExpressions = new SortSettingsForExpressions();
  // The base class skips the service's synchronous [] seed, so the first
  // real emission may arrive after the first render; never leave this
  // unassigned or the template's displayedItems.length throws.
  displayedItems: Expression[] = [];

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    super.ngOnInit();
  }

  // PUBLIC METHODS

  onCreate(): void {
    for (const expression of this.allItems) {
      if (expression.isEditable === true) {
        return;
      }
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
    this.displayedItems = this.sortSettings.getItemsToDisplay(
      this.allItems,
      false,
    );
  }

  onMessagesObservableUpdate(expressions: Expression[]): void {
    expressions = this.messageService.filterByType(
      expressions,
      MessageConstants.Types.Expression,
    );

    // A first emit (even an empty list) ends the skeleton; the base class
    // filters out the BehaviorSubject seed replay before calling this.
    this.isLoading = false;

    this.sortSettings.activeFilterParams = this.queryParams;

    this.allItems = this.arrayService.shuffle(expressions);
    this.displayedItems = this.sortSettings.getItemsToDisplay(
      this.allItems,
      false,
    );
  }

  setSortProperty(activeSortProperty: SortProperty) {
    const isSameProperty = this.sortSettings.activeSortProperty === activeSortProperty;
    if (isSameProperty) {
      this.sortSettings.reverseSortDirection();
    } else {
      this.sortSettings.activeSortProperty = activeSortProperty;
    }

    const shouldResort =
      this.sortSettings.activeSortProperty !==
      this.sortSettings.availableSortProperties.random;

    this.displayedItems = this.sortSettings.getItemsToDisplay(
      this.allItems,
      shouldResort,
    );
  }

  reverseSortDirection() {
    this.sortSettings.reverseSortDirection();
    this.displayedItems = this.displayedItems.reverse();
  }

  shouldDisplayShowAllButton(): boolean {
    return this.sortSettings.hasActiveFilterParams();
  }

  onShowAll() {
    this.routingService.clearQueryParams();
    this.sortSettings.activeFilterParams = {};
    this.displayedItems = this.sortSettings.getItemsToDisplay(this.allItems);
  }

  cancelEdit(expression: Expression) {
    expression.isEditable = false;
    this.displayedItems = this.sortSettings.getItemsToDisplay(
      this.allItems,
      false,
    );
  }
}
