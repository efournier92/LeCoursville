export interface PromptButton {
  label: string;
  color: string;
  isConfirmAction: boolean;
  /** Render as a destructive action (red fill + warning icon). */
  destructive?: boolean;
}
