import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';
import { AudioAlbum } from '../models/media';
import { JsonService } from '../services/json.service';

@Component({
  selector: 'app-admin-media-upload-audio-album',
  templateUrl: './admin-media-upload-audio-album.component.html',
  styleUrls: ['./admin-media-upload-audio-album.component.scss']
})
export class AdminMediaUploadAudioAlbumComponent implements OnInit {
  album: AudioAlbum = new AudioAlbum();

  constructor(
    private jsonService: JsonService,
  ) { }

  ngOnInit(): void {
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
}
