import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HighlightService {

  constructor() { }

  highlightElement(highlights: object[], element: string, value: boolean) {
    highlights[element] = value;
    return highlights;
  }
}
