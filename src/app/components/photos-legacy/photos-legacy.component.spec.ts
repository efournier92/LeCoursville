import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { vi } from 'vitest';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { PhotosLegacyComponent } from './photos-legacy.component';

describe('PhotosLegacyComponent', () => {
  let component: PhotosLegacyComponent;
  let fixture: ComponentFixture<PhotosLegacyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatMenuModule, FormsModule],
      declarations: [PhotosLegacyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PhotosLegacyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('searches as the filter input changes', () => {
    const searchPhotos = vi.spyOn(component, 'searchPhotos');
    const input = fixture.nativeElement.querySelector(
      '.photos-filter-field input',
    ) as HTMLInputElement;

    input.value = 'Beach';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(searchPhotos).toHaveBeenCalledWith('Beach');
  });

  it('clear resets the search term', () => {
    component.searchTerm = 'Beach';
    fixture.detectChanges();
    const clearSearchTerm = vi.spyOn(component, 'clearSearchTerm');

    const clear = fixture.nativeElement.querySelector(
      'button[aria-label="Clear"]',
    ) as HTMLButtonElement;
    expect(clear).not.toBeNull();

    clear.click();

    expect(clearSearchTerm).toHaveBeenCalled();
  });

  it('opens the sort menu with all sort options', async () => {
    const trigger = fixture.nativeElement.querySelector(
      '.d-md-none button',
    ) as HTMLButtonElement;
    expect(trigger.textContent.trim()).toBe('Sort');

    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const labels = Array.from(
      document.querySelectorAll('.mat-mdc-menu-item'),
    ).map(item => item.textContent.trim());

    expect(labels).toContain('Random');
    expect(labels).toContain('Date Taken');
    expect(labels).toContain('Recently Added');
  });

  it('offers the photo upload control to admins only', () => {
    const fileInput = () =>
      fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput()).toBeNull();

    component.user = { roles: { admin: true } } as any;
    fixture.detectChanges();

    expect(fileInput()).not.toBeNull();
    expect(fileInput().multiple).toBe(true);
    expect(fileInput().accept).toBe('image/*');
  });

  it('loads ten more photos from the Load More button', () => {
    const loadMorePhotos = vi.spyOn(component, 'loadMorePhotos');
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('.photos-component-container button') as NodeListOf<HTMLButtonElement>,
    ).find(candidate => candidate.textContent?.includes('Load More'));

    expect(button).toBeDefined();
    button.click();

    expect(loadMorePhotos).toHaveBeenCalledWith(10);
  });
});
