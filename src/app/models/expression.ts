import { Message } from "./message";
import { ExpressionConstants } from 'src/app/constants/expression-constants';

export class Expression extends Message {
  yearWritten: string;
  attribution: string;

  constructor(
    isEditable: boolean = false,
    title: string = '',
    body: string = '',
    author: string = '',
    yearWritten: string = '',
    attribution: string = '',
  ){
    super(title, body, '', '', author, false, isEditable, 0);
    this.yearWritten = yearWritten;
    this.attribution = attribution;
    this.messageType = ExpressionConstants.Types.Expression
  }
}
