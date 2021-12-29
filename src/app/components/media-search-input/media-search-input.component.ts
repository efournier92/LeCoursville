import { Component, EventEmitter, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-media-search-input',
  templateUrl: './media-search-input.component.html',
  styleUrls: ['./media-search-input.component.scss']
})
export class MediaSearchInputComponent implements OnInit {
  inputValue = '';
  @Output() inputChangeEvent = new EventEmitter<string>();

  constructor() { }

  // LIFECYCLE HOOKS

  ngOnInit(): void { }

  // PUBLIC METHODS

  clearInput(): void {
    this.inputValue = '';
  }

  onInputChange(inputValue: string): void {
    this.inputChangeEvent.emit(inputValue);
  }

}
