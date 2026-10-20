import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  AdminPhotoAlbumUploadDialogComponent,
  AdminPhotoAlbumUploadDialogData,
} from './admin-photo-album-upload-dialog.component';

describe('AdminPhotoAlbumUploadDialogComponent', () => {
  let fixture: ComponentFixture<AdminPhotoAlbumUploadDialogComponent>;
  let component: AdminPhotoAlbumUploadDialogComponent;
  let dialogRef: { close: jasmine.Spy };
  let data: AdminPhotoAlbumUploadDialogData;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminPhotoAlbumUploadDialogComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPhotoAlbumUploadDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    dialogRef = { close: jasmine.createSpy('close') };
    data = { albumTitle: '', fileCount: 2 };
  });

  it('disables submit until the title is valid', async () => {
    await create();
    const submit = fixture.nativeElement.querySelector('button[mat-flat-button]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    component.title = '  ';
    fixture.detectChanges();
    expect(submit.disabled).toBe(true);

    component.title = 'Reunion 2026';
    fixture.detectChanges();
    expect(submit.disabled).toBe(false);
  });

  it('shows a required-field message after blur when the title is empty', async () => {
    await create();
    expect(fixture.nativeElement.querySelector('.upload-dialog-error')).toBeNull();

    component.onBlur();
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('.upload-dialog-error');
    expect(error?.textContent).toContain('required');
    expect(error.getAttribute('role')).toBe('alert');
  });

  it('renders the no-images warning as an alert', async () => {
    data = { albumTitle: 'Empty folder', fileCount: 0 };
    await create();
    const warning = fixture.nativeElement.querySelector('.upload-dialog-warning');
    expect(warning).not.toBeNull();
    expect(warning.getAttribute('role')).toBe('alert');
  });

  it('closes with a start result on submit', async () => {
    await create();
    component.title = 'Reunion 2026';
    component.onStart();
    expect(dialogRef.close).toHaveBeenCalledWith({ action: 'start', title: 'Reunion 2026' });
  });

  it('closes with a cancel result and refuses to cancel while uploading', async () => {
    await create();
    component.onCancel();
    expect(dialogRef.close).toHaveBeenCalledWith({ action: 'cancel' });

    dialogRef.close = jasmine.createSpy('close');
    component.isUploading = true;
    component.onCancel();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('disables both actions while uploading', async () => {
    await create();
    component.title = 'Reunion 2026';
    component.isUploading = true;
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });
});
