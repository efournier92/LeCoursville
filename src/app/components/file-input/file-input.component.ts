import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';

interface HTMLInput extends HTMLElement {
  value: any;
  files: any;
}

@Component({
  selector: 'app-file-input',
  templateUrl: './file-input.component.html',
  styleUrls: ['./file-input.component.scss']
})
export class FileInputComponent implements OnInit {
  @Input() matIcon: string;
  @Input() inputMessage: string;
  @Input() shouldAllowMultipleFiles = false;
  @Input() shouldShowLabel = false;
  @Input() shouldShowClearButton = false;

  @Output() inputFileChangeEvent: EventEmitter<HTMLInput> = new EventEmitter();
  @Output() inputClearedEvent: EventEmitter<HTMLInput> = new EventEmitter();

  fileInput: HTMLInput;
  inputPlaceholder: string;

  constructor() { }

  // LIFECYCLE HOOKS

  ngOnInit() {
    this.fileInput = document.getElementById('file-input-file') as HTMLInput;
    this.inputPlaceholder = this.inputMessage;
  }

  // PUBLIC METHODS

  onInputChange() {
    this.fileInput = document.getElementById('file-input-file') as HTMLInput;

    if (!this.fileInput) { return; }

    this.inputFileChangeEvent.emit(this.fileInput.files);

    this.changeInputText();
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

  shouldAllowCancel(): boolean {
    if (this.fileInput && this.fileInput.files && this.fileInput.files.length > 0) {
      return true;
    } else {
      return false;
    }
  }

  clearInput() {
    this.fileInput.value = '';
    this.inputPlaceholder = this.inputMessage;
    this.inputClearedEvent.emit();
  }
}
