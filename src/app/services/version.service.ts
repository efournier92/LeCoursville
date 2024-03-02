import { Injectable } from "@angular/core";
import * as packageInfo from "package.json";

declare global {
  interface Window {
    version: any;
  }
}

@Injectable({
  providedIn: "root",
})
export class VersionService {
  constructor() {}

  getAppVersion(): string {
    const info = packageInfo;
    return info.version;
  }

  writeVersionToWindow() {
    window.version = this.getAppVersion();
  }
}
