import { Injectable } from '@angular/core';
import * as packageInfo from 'package.json';

@Injectable({
  providedIn: 'root'
})
export class VersionService {

  constructor() { }

  getAppVersion(): string {
    const info = packageInfo;
    return info.version;
  }
}
