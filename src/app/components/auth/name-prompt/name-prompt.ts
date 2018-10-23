import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { AuthService } from '../auth.service';
import { User } from '../user';

@Component({
    selector: 'name-prompt',
    templateUrl: 'name-prompt.html',
})
export class NamePrompt {
    userName: string;
    user: User;

    constructor(
        public auth: AuthService,
        public dialogRef: MatDialogRef<NamePrompt>,
        @Inject(MAT_DIALOG_DATA) public data: string,
    ) { 
        this.auth.userObservable.subscribe(
            (user: User) => this.user = user
        )
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    saveUserName() {
        this.user.name = this.userName;
        this.auth.setUser(this.user, undefined);
        this.dialogRef.close();
    }

}
