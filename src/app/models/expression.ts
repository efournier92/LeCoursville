import { Message } from "./message";
import { ExpressionConstants } from 'src/app/constants/expression-constants';

export class Expression extends Message {
  yearWritten: string;
  attribution: string;
  // TODO: Move to message, address there
  messageType: string;

  constructor(
    title: string,
    body: string,
    author: string,
    yearWritten: string,
    attribution: string,
  ){
    super(title, body, '', '', author, false, false, 0);
    this.yearWritten = yearWritten;
    this.attribution = attribution;
    this.messageType = ExpressionConstants.Types.Expression
  }
}
