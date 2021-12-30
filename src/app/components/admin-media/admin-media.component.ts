import { Component, OnInit } from '@angular/core';
import { JsonService } from 'src/app/services/json.service';
import { JsonValidationResponse } from 'src/app/models/json-validation-response';
import { _ } from 'core-js';
import { AudioAlbum } from 'src/app/models/media/audio-album';

@Component({
  selector: 'app-admin-media',
  templateUrl: './admin-media.component.html',
  styleUrls: ['./admin-media.component.scss']
})
export class AdminMediaComponent implements OnInit {
  mediaTypes: string[] = ['Videos', 'Photos', 'Photo Album', 'Audio Track', 'Audio Album'];
  selectedMediaType: string;
  selectedFile: any;
  successMessages: string[];
  errorMessages: string[];
  driveFolderId = '';
  album: AudioAlbum = new AudioAlbum();

  constructor(
    private jsonService: JsonService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.jsonService.successMessagesObservable.subscribe(
      (messages: string[]) => {
        this.successMessages = messages;
      }
    );
  }

  // PUBLIC METHODS

  // TODO: Remove redundant methods below 

  inputFileChangeEvent(files: any): void {
    this.clearMessages();
    this.selectedFile = files[0];
    const fileReader = new FileReader();
    fileReader.readAsText(this.selectedFile, 'UTF-8');
    fileReader.onload = () => {
      const jsonString = fileReader.result as string;
      this.parseJson(jsonString);
    };
    fileReader.onerror = (error) => {
      console.log(error);
    };
  }

  private clearMessages(): void {
    this.errorMessages = [];
    this.successMessages = [];
  }

  private parseJson(jsonString: string): void {
    const validationResponse = this.jsonService.isValidJson(jsonString);
    if (validationResponse.isValid) {
      const json = JSON.parse(jsonString);
      this.bulkUploadMedia(json);
    } else {
      validationResponse.message = 'ERROR: Uploaded file is not valid JSON.';
      this.printJsonErrors(validationResponse);
    }
  }

  private bulkUploadMedia(mediaArray: any) {
    if (!Array.isArray(mediaArray)) {
      const validationResponse = new JsonValidationResponse();
      validationResponse.message = 'ERROR: Uploaded JSON file is not an array.';
      this.printJsonErrors(validationResponse);
    }
    this.jsonService.bulkUploadMediaFromJson(mediaArray);
  }

  private printJsonErrors(validationResponse: JsonValidationResponse): void {
    if (!validationResponse) {
      return;
    }

    if (validationResponse.message) {
      this.errorMessages.push(validationResponse.message);
    }

    if (validationResponse.error && validationResponse.error.message) {
      this.errorMessages.push(validationResponse.error.message);
    }

    if (validationResponse.error && validationResponse.error.stack) {
      this.errorMessages.push(validationResponse.error.stack);
    }
  }

}
