import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Media } from 'src/app/models/media';

@Component({
  selector: 'app-media-search-input',
  templateUrl: './media-search-input.component.html',
  styleUrls: ['./media-search-input.component.scss']
})
export class MediaSearchInputComponent implements OnInit {
  inputValue : string = "";
  @Output() inputChangeEvent = new EventEmitter<string>();

  constructor() { }

  ngOnInit(): void {
  }

  clearInput(): void {
    this.inputValue = "";
  } 

  onInputChange(inputValue: string): void {
    this.inputChangeEvent.emit(inputValue);
  }

}
