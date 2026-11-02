import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageViewComponent } from 'src/app/components/message-view/message-view.component';

@Component({
    selector: 'app-expression-view',
    templateUrl: './expression-view.component.html',
    styleUrls: ['./expression-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExpressionViewComponent extends MessageViewComponent {
  // Inherits functionality from messages
  // Maintained as a separate component for templating purposes

  // Edit control shows only when the expressions list is rendered on the
  // admin route (/admin/expressions); member routes are read-only.
  private readonly router = inject(Router);

  get isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }
}
