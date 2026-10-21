import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { of, Subject } from "rxjs";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "../components/confirm-dialog/confirm-dialog.component";
import { ConfirmDialogService } from "./confirm-dialog.service";

describe("ConfirmDialogService", () => {
  let service: ConfirmDialogService;
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  const data: ConfirmDialogData = {
    title: "Delete photo?",
    message: "This cannot be undone.",
    destructive: true,
  };

  const closeWith = (result: boolean | undefined) => {
    dialogSpy.open.and.returnValue({ afterClosed: () => of(result) } as any);
  };

  beforeEach(() => {
    dialogSpy = jasmine.createSpyObj("MatDialog", ["open"]);

    TestBed.configureTestingModule({
      providers: [
        ConfirmDialogService,
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    service = TestBed.inject(ConfirmDialogService);
  });

  it("opens the confirm dialog with the caller's data and dialog sizing", async () => {
    closeWith(false);

    await service.confirm(data);

    expect(dialogSpy.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
      data,
      width: "420px",
      maxWidth: "calc(100vw - 32px)",
    });
  });

  it("resolves true when the dialog closes true", async () => {
    closeWith(true);

    await expect(service.confirm(data)).resolves.toBe(true);
  });

  it("resolves false when the dialog closes false", async () => {
    closeWith(false);

    await expect(service.confirm(data)).resolves.toBe(false);
  });

  it("resolves false when the dialog is dismissed", async () => {
    closeWith(undefined);

    await expect(service.confirm(data)).resolves.toBe(false);
  });

  it("denies an overlapping call instead of sharing the open dialog's answer", async () => {
    const closed = new Subject<boolean>();
    dialogSpy.open.and.returnValue({ afterClosed: () => closed.asObservable() } as any);

    const first = service.confirm(data);
    const second = service.confirm(data);

    expect(dialogSpy.open).toHaveBeenCalledTimes(1);

    closed.next(true);
    closed.complete();

    // The first caller gets the user's answer; the overlapping caller is
    // denied so it cannot run a different action on another dialog's answer.
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
  });
});
