import { TestBed, inject } from "@angular/core/testing";
import { PromptModalService } from "./prompt-modal.service";

describe("PromptModalService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PromptModalService],
    });
  });

  it("should be created", inject(
    [PromptModalService],
    (service: PromptModalService) => {
      expect(service).toBeTruthy();
    },
  ));
});
