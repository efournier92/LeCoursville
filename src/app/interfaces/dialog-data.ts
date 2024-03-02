import { PromptButton } from "./prompt-button";

export interface DialogData {
  header: string;
  message: string;
  buttons: PromptButton[];
}
