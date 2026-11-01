import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-load-error',
  standalone: true,
  template: `
    <div class="lv-load-error" role="alert">
      <span>{{ message }}</span>
      @if (showRetry) {
        <button type="button" (click)="retry.emit()">Try again</button>
      }
    </div>
  `,
  styles: `
    .lv-load-error {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      padding: 12px 16px;
      border-left: 4px solid var(--color-error);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--color-error) 8%, transparent);
    }

    .lv-load-error button {
      border: 1px solid currentColor;
      border-radius: var(--radius-control, 999px);
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 4px 16px;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LvLoadErrorComponent {
  @Input() message = 'Something went wrong loading this.';
  /** A not-found state has nothing to retry; hide the action there. */
  @Input() showRetry = true;
  @Output() retry = new EventEmitter<void>();
}
