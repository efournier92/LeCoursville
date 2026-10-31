import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { ConfirmDialogComponent, ConfirmDialogData } from "./confirm-dialog.component";

describe("ConfirmDialogComponent", () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let dialogRef: { close: jasmine.Spy };
  let data: ConfirmDialogData;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatDialogModule, MatButtonModule],
      declarations: [ConfirmDialogComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
  }

  function findButton(label: string): HTMLButtonElement {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    const button = buttons.find((candidate) => candidate.textContent?.includes(label));
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  }

  beforeEach(() => {
    dialogRef = { close: jasmine.createSpy('close') };
    data = {
      title: 'Delete user?',
      message: 'Delete Ada Lovelace? This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    };
  });

  it("renders the title and message", async () => {
    await create();

    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Delete user?');
    expect(
      fixture.nativeElement.querySelector('.confirm-dialog-message').textContent,
    ).toContain('Delete Ada Lovelace?');
  });

  it("closes with true when confirm is clicked", async () => {
    await create();

    findButton('Delete').click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it("closes with false when cancel is clicked", async () => {
    await create();

    findButton('Cancel').click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it("marks the confirm button destructive when destructive is true", async () => {
    await create();

    const button = findButton('Delete');
    expect(button.classList.contains('btn-destructive')).toBe(true);
    expect(button.querySelector('mat-icon')).toBeTruthy();
  });

  it("leaves the confirm button non-destructive when destructive is false", async () => {
    data.destructive = false;
    data.confirmLabel = 'Continue';
    await create();

    const button = findButton('Continue');
    expect(button.classList.contains('btn-destructive')).toBe(false);
    expect(button.querySelector('mat-icon')).toBeNull();
  });
});
