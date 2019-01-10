import { TestBed, inject } from '@angular/core/testing';

import { ConfirmPromptService } from './confirm-prompt.service';

describe('ConfirmPromptService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfirmPromptService]
    });
  });

  it('should be created', inject([ConfirmPromptService], (service: ConfirmPromptService) => {
    expect(service).toBeTruthy();
  }));
});
