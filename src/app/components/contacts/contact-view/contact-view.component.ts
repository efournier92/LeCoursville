import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Contact } from 'src/app/models/contact';

@Component({
    selector: 'app-contact-view',
    templateUrl: './contact-view.component.html',
    styleUrls: ['./contact-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ContactViewComponent {
  @Input() contact: Contact;
}
