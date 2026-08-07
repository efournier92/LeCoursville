import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { PromptModalComponent } from "./prompt-modal.component";

describe("PromptModalComponent", () => {
  let component: PromptModalComponent;
  let fixture: ComponentFixture<PromptModalComponent>;
  let dialogRef: any;

  beforeEach(() => {
    dialogRef = {
      componentInstance: { data: {} },
      close: jasmine.createSpy('close'),
    };

    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [PromptModalComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { header: 'Are You Sure?', message: 'Do it?', buttons: [] } },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PromptModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("falls back to default No/Yes buttons when none are configured", () => {
    expect(component.buttons.length).toBe(2);
    expect(component.buttons[0].label).toBe('No');
    expect(component.buttons[1].label).toBe('Yes');
    expect(component.buttons[1].isConfirmAction).toBe(true);
  });

  it("onCancelClick closes the dialog with an empty string", () => {
    component.onCancelClick();
    expect(dialogRef.close).toHaveBeenCalledWith('');
  });

  it("onActionClick closes the dialog with the user's choice", () => {
    component.onActionClick(true);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
