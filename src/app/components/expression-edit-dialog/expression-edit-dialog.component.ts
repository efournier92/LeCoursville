import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Expression } from 'src/app/models/expression';
import { MessageService } from 'src/app/services/message.service';

export interface ExpressionEditDialogData {
  expression: Expression | null;
  authorId: string;
}

@Component({
  selector: 'app-expression-edit-dialog',
  templateUrl: './expression-edit-dialog.component.html',
  styleUrls: ['./expression-edit-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ExpressionEditDialogComponent {
  title = '';
  attribution = '';
  authorName = '';
  yearWritten = '';
  body = '';
  saving = false;
  error: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<ExpressionEditDialogComponent, Expression | null>,
    @Inject(MAT_DIALOG_DATA) public data: ExpressionEditDialogData,
    private messageService: MessageService,
  ) {
    if (data.expression) {
      this.title = data.expression.title || '';
      this.attribution = data.expression.attribution || '';
      this.authorName = data.expression.authorName || '';
      this.yearWritten = data.expression.yearWritten || '';
      this.body = data.expression.body || '';
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSave(): void {
    const title = this.title.trim();
    if (!title) {
      this.error = 'Expression is required.';
      return;
    }
    if (this.saving) {
      return;
    }

    const expr = this.data.expression
      ? Object.assign(new Expression(false, this.data.expression.authorId), this.data.expression)
      : new Expression(false, this.data.authorId, title, this.body, this.authorName, this.yearWritten, this.attribution);
    expr.title = title;
    expr.body = this.body;
    expr.authorName = this.authorName;
    expr.yearWritten = this.yearWritten;
    expr.attribution = this.attribution;
    if (!this.data.expression) {
      expr.isSaved = true;
    }

    this.saving = true;
    this.error = null;
    try {
      if (this.data.expression) {
        this.messageService.updateMessage(expr);
      } else {
        this.messageService.create(expr);
      }
      this.dialogRef.close(expr);
    } catch (error) {
      this.error = 'Couldn\'t save this expression. Please try again.';
    } finally {
      this.saving = false;
    }
  }
}
