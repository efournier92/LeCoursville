import { Component, OnInit } from '@angular/core';
import { JsonService } from 'src/app/services/json.service';
import { JsonValidationResponse } from 'src/app/models/json-validation-response';
import { _ } from 'core-js';
import { AudioAlbum } from 'src/app/models/media';
import { environment } from 'src/environments/environment';


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
  driveFolderId: string = "";
  album: AudioAlbum = new AudioAlbum();

  constructor(
    private jsonService: JsonService,
  ) { }

  ngOnInit(): void {
    this.jsonService.successMessagesObservable.subscribe(
      (messages: string[]) => {
        this.successMessages = messages;
      }
    );
  }

  onInputFileChange(files: any): void {
    this.clearMessages();
    this.selectedFile = files[0];
    const fileReader = new FileReader();
    fileReader.readAsText(this.selectedFile, "UTF-8");
    fileReader.onload = () => {
      const jsonString = fileReader.result as string;
      this.parseJson(jsonString);
    }
    fileReader.onerror = (error) => {
      console.log(error);
    }
  }

  uploadByDriveId(): void {
    var apiKey = environment.googleDriveApiKey;
  
    var apiUrl = `https://www.googleapis.com/drive/v3/files?q='${this.album.url}'+in+parents&fields=files(id,+originalFilename)&key=${apiKey}`;

    var jsonString = this.httpGet(apiUrl);
   
    var allInfo = JSON.parse(jsonString);
  
    var files = allInfo.files;
    
    var allFilesToUpload = [];
  
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
  
      if (!file) continue;
  
      var fileUploadInfo = {
        "url": `https://drive.google.com/file/d/${file.id}/view?usp=sharing`,
        "name": this.formatFileName(file.originalFilename),
        "type": "audio-track"
      };
  
      allFilesToUpload.push(fileUploadInfo);
    }

    var albumInfo = {
      "name": this.album.name,
      "icon": this.album.icon,
      "type": "audio-album",
      "listing": allFilesToUpload
    } 

    this.jsonService.uploadAudioAlbum(albumInfo);
  }

  httpGet(theUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}

private formatFileName(name) {
  if (name.includes(".mp3"))
    return name.replace(".mp3", "");
  
  return name;
}

  onInputCleared(): void {
    this.clearMessages();
  }

  private clearMessages(): void {
    this.errorMessages = [];
    this.successMessages = [];
  }

  private parseJson(jsonString: string): void {
    var validationResponse = this.jsonService.isValidJson(jsonString);
    if (validationResponse.isValid) {
      const json = JSON.parse(jsonString);
      this.bulkUploadMedia(json);
    } else {
      validationResponse.message = "ERROR: Uploaded file is not valid JSON.";
      this.printJsonErrors(validationResponse);
    }
  }

  private bulkUploadMedia(mediaArray: any) {
    if (!Array.isArray(mediaArray)) {
      let validationResponse = new JsonValidationResponse();
      validationResponse.message = "ERROR: Uploaded JSON file is not an array.";
      this.printJsonErrors(validationResponse);
    }
    this.jsonService.bulkUploadMediaFromJson(mediaArray)
  }

  private printJsonErrors(validationResponse: JsonValidationResponse): void {
    if (!validationResponse)
      return;
      
    if (validationResponse.message)
      this.errorMessages.push(validationResponse.message);

    if (validationResponse.error && validationResponse.error.message)
      this.errorMessages.push(validationResponse.error.message);

    if (validationResponse.error && validationResponse.error.stack)
      this.errorMessages.push(validationResponse.error.stack);
  }

}
