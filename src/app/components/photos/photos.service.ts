import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export class Photo {
  path: String;
  info: String;
}

@Injectable({
  providedIn: 'root'
})
export class PhotosService {

  constructor(private http: HttpClient) { }

  

}
