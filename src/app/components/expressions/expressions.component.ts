import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageComponent } from 'src/app/components/message/message.component';
import { Expression } from 'src/app/models/expression';
import { ExpressionConstants } from 'src/app/constants/expression-constants';
import { MessageConstants } from 'src/app/constants/message-constants';
import { SortSettingsForExpressions } from 'src/app/models/sort-settings-for-expressions';
import { SortProperty } from 'src/app/models/sort-settings';
import { AuthService } from 'src/app/services/auth.service';
import { MessageService } from 'src/app/services/message.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { ArrayService } from 'src/app/services/array.service';
import { RoutingService } from 'src/app/services/routing.service';
import {
  ExpressionEditDialogComponent,
  ExpressionEditDialogData,
} from 'src/app/components/expression-edit-dialog/expression-edit-dialog.component';

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
  messageType: string = MessageConstants.Types.Expression;
  sortSettings: SortSettingsForExpressions = new SortSettingsForExpressions();
  // The base class skips the service's synchronous [] seed, so the first
  // real emission may arrive after the first render; never leave this
  // unassigned or the template's displayedItems.length throws.
  displayedItems: Expression[] = [];

  constructor(
    messageService: MessageService,
    authService: AuthService,
    analyticsService: AnalyticsService,
    arrayService: ArrayService,
    routingService: RoutingService,
    activatedRoute: ActivatedRoute,
    private dialog: MatDialog,
    private router: Router,
  ) {
    super(messageService, authService, analyticsService, arrayService, routingService, activatedRoute);
  }

  get canEditExpressions(): boolean {
    return !!(this.user?.roles?.admin) && this.router.url.startsWith('/admin');
  }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    super.ngOnInit();
  }

  // PUBLIC METHODS

  onCreate(): void {
    if (!this.canEditExpressions) {
      return;
    }

    this.analyticsService.logEvent('expression_create', {
      userId: this.user?.id,
    });
    this.openEditor(null);
  }

  onEdit(expression: Expression): void {
    if (!this.canEditExpressions) {
      return;
    }

    this.analyticsService.logEvent('expression_edit', {
      id: expression?.id,
      userId: this.user?.id,
    });
    this.openEditor(expression, expression.authorId);
  }

  private openEditor(expression: Expression | null, authorId: string = this.user.id): void {
    this.dialog.open<ExpressionEditDialogComponent, ExpressionEditDialogData, Expression | null>(
      ExpressionEditDialogComponent,
      {
        data: { expression, authorId },
        panelClass: 'expression-edit-dialog-panel',
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '98vh',
        autoFocus: 'first-tabbable',
        disableClose: true,
      },
    );
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

    // The base class resolves `loading` before this runs, so the first real
    // emit (even an empty list) already ended the skeleton.
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
}
