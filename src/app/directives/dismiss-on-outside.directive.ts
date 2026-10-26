import { Directive, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export type DismissReason = 'outside' | 'escape';

/**
 * Closes a popover on an outside pointerdown or Escape. Later dropdowns reuse
 * this one directive, so no surface adds its own document-level listener.
 */
@Directive({
  selector: '[appDismissOnOutside]',
  standalone: true,
})
export class DismissOnOutsideDirective {
  /** The toggle element; a pointerdown inside it is not "outside". */
  @Input() dismissIgnore: HTMLElement | null = null;

  @Output() dismiss = new EventEmitter<DismissReason>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('document:pointerdown', ['$event'])
  onPointerDown(event: Event): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (this.host.nativeElement.contains(target)) return;
    if (this.dismissIgnore?.contains(target)) return;
    this.dismiss.emit('outside');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss.emit('escape');
  }
}
