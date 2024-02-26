import { Message } from "./message";
import { MessageConstants } from 'src/app/constants/message-constants';

export class Expression extends Message {
  yearWritten: string;
  attribution: string;

  constructor(
    isEditable: boolean = false,
    authorId: string,
    title: string = '',
    body: string = '',
    authorName: string = '',
    yearWritten: string = '',
    attribution: string = '',
  ) {
    super(title, body, '', authorId, authorName, false, isEditable, 0);
    this.yearWritten = yearWritten;
    this.attribution = attribution;
    this.messageType = MessageConstants.Types.Expression
  }
}
