import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { vi } from 'vitest';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ExpressionsComponent } from './expressions.component';
import { Expression } from 'src/app/models/expression';

describe('ExpressionsComponent', () => {
  let component: ExpressionsComponent;
  let fixture: ComponentFixture<ExpressionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatMenuModule],
      declarations: [ ExpressionsComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpressionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function showExpressions(): void {
    component.isLoading = false;
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

  it('shows Create only to admins', () => {
    showExpressions();
    const createButton = () =>
      fixture.nativeElement.querySelector('.create-expression-button');

    expect(createButton()).toBeNull();

    component.user = { roles: { admin: true } } as any;
    fixture.detectChanges();
    expect(createButton()).not.toBeNull();
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
