import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { vi } from 'vitest';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { Expression } from 'src/app/models/expression';
import { MessageService } from 'src/app/services/message.service';
import {
  ExpressionEditDialogComponent,
  ExpressionEditDialogData,
} from './expression-edit-dialog.component';

describe('ExpressionEditDialogComponent', () => {
  let fixture: ComponentFixture<ExpressionEditDialogComponent>;
  let component: ExpressionEditDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let messageService: { create: ReturnType<typeof vi.fn>; updateMessage: ReturnType<typeof vi.fn> };

  async function setup(data: ExpressionEditDialogData): Promise<void> {
    dialogRef = { close: vi.fn() };
    messageService = { create: vi.fn(), updateMessage: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, FormsModule, MatDialogModule, MatButtonModule, MatInputModule],
      declarations: [ExpressionEditDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ExpressionEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('prefills the fields from an existing expression', async () => {
    const expression = new Expression(false, 'a', 'T', 'B', 'Auth', '1999', 'Attr');
    await setup({ expression, authorId: 'a' });

    expect(component.title).toBe('T');
    expect(component.body).toBe('B');
    expect(component.authorName).toBe('Auth');
    expect(component.yearWritten).toBe('1999');
    expect(component.attribution).toBe('Attr');
  });

  it('rejects an empty title without saving', async () => {
    const expression = new Expression(false, 'a', 'T', 'B', '', '', '');
    await setup({ expression, authorId: 'a' });
    component.title = '   ';

    component.onSave();

    expect(component.error).toBe('Expression is required.');
    expect(messageService.updateMessage).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('updates an existing expression and closes with it', async () => {
    const expression = new Expression(false, 'a', 'T', 'B', 'Auth', '1999', 'Attr');
    await setup({ expression, authorId: 'a' });
    component.title = 'Updated';

    component.onSave();

    expect(messageService.updateMessage).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({ id: expression.id, title: 'Updated' }),
    );
  });

  it('creates a new expression with the data authorId', async () => {
    await setup({ expression: null, authorId: 'author-1' });
    component.title = 'New';
    component.body = 'Body';

    component.onSave();

    expect(messageService.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New', body: 'Body', authorId: 'author-1', isSaved: true }),
    );
    expect(messageService.updateMessage).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
