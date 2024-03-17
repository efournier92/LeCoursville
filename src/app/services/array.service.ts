import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class ArrayService {
  constructor() {}

  removeByIndex(arr: any[], index): any[] {
    return arr.splice(index, 1);
  }

  shuffle(arr: any[]): any[] {
    // for (let i = arr.length - 1; i > 0; i--) {
    //   const j = Math.floor(Math.random() * arr.length);
    //   [arr[i], arr[j]] = [arr[j], arr[i]];
    // }

    return arr.sort(() => Math.random() - 0.5);
  }
}
