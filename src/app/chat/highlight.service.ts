import { Injectable } from '@angular/core';
import { Highlight } from './highlight';

@Injectable({
  providedIn: 'root'
})
export class HighlightService {

  constructor() { }

  highlightElement(highlights: Highlight, element: string, value: boolean): Highlight {
    highlights[element] = value;
    return highlights;
  }
}
