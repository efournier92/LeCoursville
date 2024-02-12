import { Message } from "./message";

export class Expression extends Message {
  yearWritten: string;
  attribution: string;

  constructor(
    title: string,
    body: string,
    authorName: string,
    yearWritten: string,
    attribution: string,
  ){
    super(title, body, '', '', authorName, false, false, 0);
    this.yearWritten = yearWritten;
    this.attribution = attribution;
  }
}
