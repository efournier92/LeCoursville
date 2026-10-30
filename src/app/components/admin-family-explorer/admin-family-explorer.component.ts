import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  FamilyExplorerListItem,
  FamilyExplorerService,
  parseFamilyPeople,
} from 'src/app/services/family-explorer.service';
import { RtdbService } from 'src/app/services/rtdb.service';

interface ExplorerRow {
  id: string;
  title: string;
  published: boolean;
  updatedAt?: number;
}

@Component({
  selector: 'app-admin-family-explorer',
  templateUrl: './admin-family-explorer.component.html',
  styleUrls: ['./admin-family-explorer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminFamilyExplorerComponent implements OnInit, OnDestroy {
  @ViewChild('successBanner') successBanner?: ElementRef<HTMLElement>;

  rows: ExplorerRow[] = [];
  loading = true;
  actionError = '';
  formError = '';

  familyId = '';
  title = '';
  published = false;
  rawJson = '';
  selectedFileName = '';
  previewCount: number | null = null;
  submitting = false;
  successMessage = '';

  private sub?: Subscription;

  constructor(
    private rtdb: RtdbService,
    private explorers: FamilyExplorerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.explorers.listArchives().subscribe({
      next: list => {
        this.rows = Object.entries(list || {}).map(([id, item]) => ({
          id,
          title: (item as FamilyExplorerListItem).title,
          published: (item as FamilyExplorerListItem).published === true,
          updatedAt: (item as FamilyExplorerListItem).updatedAt,
        }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.actionError = 'Could not load the archives.';
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get explorerIds(): string[] {
    return this.rows.map(row => row.id);
  }

  onFamilyIdInput(): void {
    const row = this.rows.find(r => r.id === this.familyId);
    // A re-ingest must keep the row's publish state; the checkbox governs new ids only.
    if (row) {
      this.published = row.published;
    }
    this.refreshPreview();
  }

  onJsonInput(json: string): void {
    this.rawJson = json;
    this.refreshPreview();
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    await this.readFile(file);
    // Re-selecting the same file must fire change again.
    input.value = '';
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await this.readFile(file);
    }
  }

  refreshPreview(): void {
    this.formError = '';
    this.previewCount = null;
    if (!this.rawJson.trim()) {
      return;
    }
    try {
      const slugOk = /^[a-z0-9-]+$/.test(this.familyId);
      if (!slugOk) {
        this.formError = 'Family ID must be lowercase letters, numbers, and dashes.';
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
      const archiveTitle = this.title.trim();
      const existing = this.rows.find(row => row.id === this.familyId);
      const published = existing ? existing.published : this.published;
      const { count } = await this.explorers.ingest(this.familyId, archiveTitle, published, this.rawJson);
      this.successMessage = `Uploaded the ${archiveTitle} archive with ${count} people.`;
      this.resetFields();
      this.cdr.detectChanges();
      this.successBanner?.nativeElement.focus({ preventScroll: true });
      this.successBanner?.nativeElement.scrollIntoView({ block: 'nearest' });
    } catch (err) {
      this.formError = (err as Error).message;
    } finally {
      this.submitting = false;
    }
  }

  onReset(): void {
    this.resetFields();
  }

  async onTogglePublished(row: ExplorerRow): Promise<void> {
    this.actionError = '';
    try {
      // Publish switch writes exactly this leaf; the rest of the node is untouched.
      await this.rtdb.object(`familyExplorer/${row.id}/published`).set(!row.published);
    } catch (err) {
      this.actionError = (err as Error).message;
    }
  }

  private async readFile(file: File): Promise<void> {
    this.selectedFileName = file.name;
    this.onJsonInput(await file.text());
  }

  private resetFields(): void {
    this.familyId = '';
    this.title = '';
    this.published = false;
    this.rawJson = '';
    this.selectedFileName = '';
    this.previewCount = null;
    this.formError = '';
  }
}
