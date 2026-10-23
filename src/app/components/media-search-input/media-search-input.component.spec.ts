import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { MediaSearchInputComponent } from './media-search-input.component';

describe('MediaSearchInputComponent', () => {
  let component: MediaSearchInputComponent;
  let fixture: ComponentFixture<MediaSearchInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ MediaSearchInputComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaSearchInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits each typed value', () => {
    const emitted: string[] = [];
    component.inputChangeEvent.subscribe(value => emitted.push(value));

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    input.value = 'beach';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['beach']);
  });

  it('shows the clear button only when there is a value', () => {
    const clearButton = () => fixture.nativeElement.querySelector('button[aria-label="Clear"]');

    expect(clearButton()).toBeNull();

    component.inputValue = 'beach';
    fixture.detectChanges();
    expect(clearButton()).not.toBeNull();

    clearButton().click();
    fixture.detectChanges();

    expect(component.inputValue).toBe('');
    expect(clearButton()).toBeNull();
  });
});
