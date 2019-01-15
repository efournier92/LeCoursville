import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';

interface HTMLInput extends HTMLElement {
  value: any;
}

@Component({
  selector: 'app-file-input',
  templateUrl: './file-input.component.html',
  styleUrls: ['./file-input.component.scss']
})
export class FileInputComponent implements OnInit {
  @Input()
  matIcon: string;
  @Input()
  inputPlaceholder: string;
  @Input()
  multipleFiles: boolean;
  @Output()
  onInputFileChange: EventEmitter<HTMLInput> = new EventEmitter();
  fileInput: HTMLInput;
  fileInputTextDiv: HTMLInput;
  fileInputText: HTMLInput;

  constructor() { }

  ngOnInit() {
    this.fileInput = document.getElementById('file-input-file') as HTMLInput;
    this.fileInputText = document.getElementById('file-input-text') as HTMLInput;
    this.fileInputTextDiv = document.getElementById('file-input-text-container') as HTMLInput;
  }

  onInputChange() {
    this.changeInputText();
    this.onInputFileChange.emit(this.fileInput);
    if (!this.fileInput)
      return;
    this.changeInputText();
    if (this.fileInputText.value.length != 0) {
      if (!this.fileInputTextDiv.classList.contains("is-focused")) {
        this.fileInputTextDiv.classList.add('is-focused');
      }
    } else {
      if (this.fileInputTextDiv.classList.contains("is-focused")) {
        this.fileInputTextDiv.classList.remove('is-focused');
      }
    }
  }

  changeInputText() {
    const inputString = this.fileInput.value;
    let i: number;
    if (inputString.lastIndexOf('\\')) {
      i = inputString.lastIndexOf('\\') + 1;
    } else if (inputString.lastIndexOf('/')) {
      i = inputString.lastIndexOf('/') + 1;
    }
    this.inputPlaceholder = inputString.slice(i, inputString.length);
  }
}
