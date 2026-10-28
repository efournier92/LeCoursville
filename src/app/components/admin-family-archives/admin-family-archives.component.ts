import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  ArchiveListItem,
  FamilyArchiveService,
  parseFamilyPeople,
} from 'src/app/services/family-archive.service';
import { RtdbService } from 'src/app/services/rtdb.service';

interface ArchiveRow {
  id: string;
  title: string;
  published: boolean;
  updatedAt?: number;
}

@Component({
  selector: 'app-admin-family-archives',
  templateUrl: './admin-family-archives.component.html',
  styleUrls: ['./admin-family-archives.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminFamilyArchivesComponent implements OnInit, OnDestroy {
  rows: ArchiveRow[] = [];
  loading = true;
  actionError = '';
  formError = '';

  familyId = '';
  title = '';
  published = false;
  rawJson = '';
  previewCount: number | null = null;
  submitting = false;
  successMessage = '';

  private sub?: Subscription;

  constructor(
    private rtdb: RtdbService,
    private archives: FamilyArchiveService,
  ) {}

  ngOnInit(): void {
    this.sub = this.archives.listArchives().subscribe(list => {
      this.rows = Object.entries(list || {}).map(([id, item]) => ({
        id,
        title: (item as ArchiveListItem).title,
        published: (item as ArchiveListItem).published === true,
        updatedAt: (item as ArchiveListItem).updatedAt,
      }));
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get archiveIds(): string[] {
    return this.rows.map(row => row.id);
  }

  onJsonInput(json: string): void {
    this.rawJson = json;
    this.refreshPreview();
  }

  async onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.onJsonInput(await file.text());
  }

  refreshPreview(): void {
    this.formError = '';
    this.successMessage = '';
    this.previewCount = null;
    if (!this.rawJson.trim()) {
      return;
    }
    try {
      const slugOk = /^[a-z0-9-]+$/.test(this.familyId);
      if (!slugOk) {
        this.formError = 'Family id must be lowercase letters, numbers, and dashes.';
        return;
      }
      if (!this.title.trim()) {
        this.formError = 'Title is required.';
        return;
      }
      this.previewCount = parseFamilyPeople(this.rawJson).count;
    } catch (err) {
      this.formError = (err as Error).message;
    }
  }

  async onConfirm(): Promise<void> {
    this.actionError = '';
    this.successMessage = '';
    this.submitting = true;
    try {
      const { count } = await this.archives.ingest(this.familyId, this.title, this.published, this.rawJson);
      this.successMessage = `Uploaded ${count} people at ${new Date().toLocaleString()}.`;
      this.familyId = '';
      this.title = '';
      this.published = false;
      this.rawJson = '';
      this.previewCount = null;
    } catch (err) {
      this.formError = (err as Error).message;
    } finally {
      this.submitting = false;
    }
  }

  async onTogglePublished(row: ArchiveRow): Promise<void> {
    this.actionError = '';
    try {
      // Publish switch writes exactly this leaf; the rest of the node is untouched.
      await this.rtdb.object(`familyArchive/${row.id}/published`).set(!row.published);
    } catch (err) {
      this.actionError = (err as Error).message;
    }
  }
}
