import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { skipWhile } from 'rxjs/operators';
import { Contact } from 'src/app/models/contact';
import { ContactsService } from 'src/app/services/contacts.service';

// Minimal admin surface for legacy-DB contact fixups after CSV import:
// a plain list linking to the reused ContactEditComponent (spec section 6).
// The detail view derives from the live list stream - one subscription, no
// per-id object streams to track or overlap on param reuse.
@Component({
  selector: 'app-admin-contacts',
  templateUrl: './admin-contacts.component.html',
  styleUrls: ['./admin-contacts.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminContactsComponent implements OnInit, OnDestroy {
  contacts: Contact[] = [];
  contact: Contact | null = null;
  contactId: string | null = null;
  status: 'loading' | 'ready' = 'loading';

  private contactsSub: Subscription | null = null;
  private contactSub: Subscription | null = null;

  constructor(
    private contactsService: ContactsService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Skip empty emissions (the BehaviorSubject seed and any pre-data
    // replay) so a data-bearing emission flips the list ready. skip(1) is
    // wrong here: on list->detail navigation the singleton service REPLAYS
    // real data as its first emission and skip(1) would drop it forever.
    this.contactsSub = this.contactsService.userContacts
      .pipe(skipWhile((contacts) => !contacts || contacts.length === 0))
      .subscribe((contacts) => {
        this.contacts = (contacts ?? []).slice().sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        this.status = 'ready';
        this.contact = this.findContact();
      });
    this.contactSub = this.route.paramMap.subscribe((params) => {
      this.contactId = params.get('id');
      this.contact = this.findContact();
    });
  }

  ngOnDestroy(): void {
    this.contactsSub?.unsubscribe();
    this.contactSub?.unsubscribe();
  }

  private findContact(): Contact | null {
    return this.contactId ? this.contacts.find((c) => c.id === this.contactId) ?? null : null;
  }
}
