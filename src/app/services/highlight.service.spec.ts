import { TestBed } from '@angular/core/testing';

import { HighlightService } from './highlight.service';
import { Highlight } from 'src/app/models/highlight';

describe('HighlightService', () => {
  let service: HighlightService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HighlightService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('highlightElement toggles the flag and returns the same object', () => {
    const highlights = new Highlight();
    const result = service.highlightElement(highlights, 'title', true);
    expect(result).toBe(highlights);
    expect(highlights['title']).toBe(true);
  });
});
