import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ExpressionsComponent } from './expressions.component';
import { Expression } from 'src/app/models/expression';
import { ExpressionEditDialogComponent } from 'src/app/components/expression-edit-dialog/expression-edit-dialog.component';

describe('ExpressionsComponent', () => {
  let component: ExpressionsComponent;
  let fixture: ComponentFixture<ExpressionsComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatMenuModule],
      declarations: [ ExpressionsComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ExpressionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function setUrl(url: string): void {
    Object.defineProperty(router, 'url', { configurable: true, get: () => url });
  }

  function showExpressions(): void {
    component.loading = false;
    component.allItems = [
      new Expression(false, 'a', 'Patience', 'Wait for it'),
      new Expression(false, 'b', 'Courage', 'Stand tall'),
    ];
    component.displayedItems = component.sortSettings.getItemsToDisplay(
      component.allItems,
      false,
    );
    fixture.detectChanges();
  }

  it('filters the rendered list as the search query changes', () => {
    showExpressions();

    const cards = () =>
      fixture.nativeElement.querySelectorAll('.expression-card-wrapper').length;
    expect(cards()).toBe(2);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'courage';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(cards()).toBe(1);
  });

  it('gates Create to admins on the admin surface only', () => {
    setUrl('/expressions');
    component.user = { roles: { admin: true } } as any;
    showExpressions();
    const createButton = () =>
      fixture.nativeElement.querySelector('.create-expression-button');

    expect(createButton()).toBeNull();

    setUrl('/admin/expressions');
    component.user = { roles: { admin: false } } as any;
    fixture.detectChanges();
    expect(createButton()).toBeNull();

    component.user = { roles: { admin: true } } as any;
    fixture.detectChanges();
    expect(createButton()).not.toBeNull();
  });

  it('renders no inline edit surface and opens the dialog on edit', () => {
    setUrl('/admin/expressions');
    component.user = { id: 'a', roles: { admin: true } } as any;
    showExpressions();
    const expression = component.allItems[0] as Expression;
    expression.isEditable = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-expression-edit')).toBeNull();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockReturnValue({} as any);
    component.onEdit(expression);

    expect(openSpy).toHaveBeenCalledWith(
      ExpressionEditDialogComponent,
      expect.objectContaining({
        data: { expression, authorId: expression.authorId },
      }),
    );
  });

  it('opens the create dialog with a null expression on the admin surface', () => {
    setUrl('/admin/expressions');
    component.user = { id: 'u1', roles: { admin: true } } as any;
    showExpressions();
    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockReturnValue({} as any);

    component.onCreate();

    expect(openSpy).toHaveBeenCalledWith(
      ExpressionEditDialogComponent,
      expect.objectContaining({ data: { expression: null, authorId: 'u1' } }),
    );
  });

  it('does not open the create dialog off the admin surface', () => {
    setUrl('/expressions');
    component.user = { id: 'u1', roles: { admin: true } } as any;
    showExpressions();
    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockReturnValue({} as any);

    component.onCreate();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('renders the empty state when the loaded collection is empty', () => {
    component.loading = false;
    component.allItems = [];
    component.displayedItems = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.expressions-empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.expressions-skeleton')).toBeNull();
  });

  it('flips the sort icon when the direction reverses', () => {
    showExpressions();
    const icon = () =>
      fixture.nativeElement.querySelector('.sort-button mat-icon').textContent.trim();
    const before = icon();

    (fixture.nativeElement.querySelector('.sort-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(icon()).not.toBe(before);
    expect(icon()).toBe('arrow_downward');
  });

  it('resets the filter when Show All is clicked', () => {
    showExpressions();
    component.sortSettings.activeFilterParams = { authorName: 'nobody' };
    const clearQueryParams = vi.spyOn(component.routingService, 'clearQueryParams');
    fixture.detectChanges();

    const showAll = fixture.nativeElement.querySelector('.show-all-button') as HTMLButtonElement;
    expect(showAll).not.toBeNull();

    showAll.click();
    fixture.detectChanges();

    expect(clearQueryParams).toHaveBeenCalled();
    expect(component.sortSettings.activeFilterParams).toEqual({});
    expect(fixture.nativeElement.querySelector('.show-all-button')).toBeNull();
  });
});
