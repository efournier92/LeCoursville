import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { FamilyArchive, FamilyArchiveService, FamilyPerson } from 'src/app/services/family-archive.service';

@Component({
  selector: 'app-family-archive',
  templateUrl: './family-archive.component.html',
  styleUrls: ['./family-archive.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FamilyArchiveComponent implements OnInit, OnDestroy {
  familyId = '';
  loading = true;
  archive: FamilyArchive | null = null;
  available = false;
  people: FamilyPerson[] = [];
  searchText = '';
  selectedId: string | null = null;

  private sub?: Subscription;

  constructor(
    route: ActivatedRoute,
    private archives: FamilyArchiveService,
  ) {
    this.familyId = route.snapshot.paramMap.get('familyId') || '';
  }

  ngOnInit(): void {
    this.sub = this.archives.getArchive(this.familyId).subscribe(archive => {
      this.loading = false;
      this.archive = archive;
      this.available = !!archive && archive.published === true;
      this.people = archive?.people ? Object.values(archive.people) : [];
      if (this.selectedId && !archive?.people?.[this.selectedId]) {
        this.selectedId = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  select(id: string): void {
    this.selectedId = id;
  }

  get selected(): FamilyPerson | null {
    if (!this.selectedId || !this.archive?.people) {
      return null;
    }
    return this.archive.people[this.selectedId] || null;
  }
}
