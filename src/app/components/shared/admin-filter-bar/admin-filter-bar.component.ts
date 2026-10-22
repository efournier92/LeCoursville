import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Fixed-height filter row under `app-page-toolbar`.
 *
 * Search goes in `[admin-filter-search]` (unmarked projection also lands
 * there); sort and segmented controls go in `[admin-filter-actions]`, which is
 * right-aligned.
 *
 * The element's presence is the "this page has filters" flag: include it only
 * when filters render. There is deliberately no boolean input to forget, and
 * no projected-content query (which cannot reliably see `@if` content).
 */
@Component({
  selector: 'app-admin-filter-bar',
  templateUrl: './admin-filter-bar.component.html',
  styleUrls: ['./admin-filter-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AdminFilterBarComponent {}
