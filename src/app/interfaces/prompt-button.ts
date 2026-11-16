export interface PromptButton {
  label: string;
  color?: 'primary' | 'accent' | 'warn';
  isConfirmAction: boolean;
  /** Render as a destructive action (red fill + warning icon). */
  destructive?: boolean;
}
