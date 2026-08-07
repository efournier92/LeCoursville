import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { PromptModalService } from "./prompt-modal.service";
import { PromptModalComponent } from "../components/prompt-modal/prompt-modal.component";

describe("PromptModalService", () => {
  let service: PromptModalService;
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  beforeEach(() => {
    dialogSpy = jasmine.createSpyObj("MatDialog", ["open"]);
    dialogSpy.open.and.returnValue({ afterClosed: () => ({ subscribe: () => {} }) } as any);

    TestBed.configureTestingModule({
      providers: [
        PromptModalService,
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    service = TestBed.inject(PromptModalService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("openDialog opens the prompt modal with header, message and buttons", () => {
    const buttons = [{ label: 'Yes', color: 'primary', isConfirmAction: true }];
    const ref = service.openDialog('Are You Sure?', 'Do it?', buttons);

    expect(dialogSpy.open).toHaveBeenCalledWith(PromptModalComponent, {
      data: { header: 'Are You Sure?', message: 'Do it?', buttons },
    });
    expect(ref).toBeDefined();
  });
});
