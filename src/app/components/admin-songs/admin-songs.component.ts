import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, Subscription } from 'rxjs';
import { Person } from 'src/app/models/person';
import { Song } from 'src/app/models/song';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { parseSongText, ParsedSong } from 'src/app/services/song-parser';
import { PeopleService } from 'src/app/services/people.service';
import { SongsService } from 'src/app/services/songs.service';
import {
  SongDraftDialogComponent,
  SongDraftDialogData,
} from '../song-draft-dialog/song-draft-dialog.component';

/** Case- and diacritic-insensitive fold shared by search and parser semantics. */
function fold(value: string | null | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Human column date: "Oct 31, 2026". */
const UPDATED_FORMAT = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Reject oversized imports before reading them into the draft flow. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-admin-songs',
  templateUrl: './admin-songs.component.html',
  styleUrls: ['./admin-songs.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminSongsComponent implements OnInit, OnDestroy {
  songs: Song[] = [];
  people: Person[] = [];
  searchTerm = '';
  activeQuery = '';
  status: 'loading' | 'error' | 'ready' = 'loading';
  showAddPanel = false;
  pasteText = '';
  pickedFileCount = 0;
  actionError: string | null = null;
  peopleLoaded = false;
  importing = false;
  skeletonIterations = [1, 2, 3, 4, 5, 6];

  private songsSub: Subscription | null = null;
  private peopleSub: Subscription | null = null;
  private peopleLoadedSub: Subscription | null = null;
  private peopleById = new Map<string, Person>();

  constructor(
    private songsService: SongsService,
    private peopleService: PeopleService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadSongs();
    this.peopleSub = this.peopleService.people$.subscribe(people => {
      this.people = people || [];
      this.peopleById = new Map(this.people.map(person => [person.id, person]));
    });
    this.peopleLoadedSub = this.peopleService.peopleLoaded$.subscribe(loaded => {
      this.peopleLoaded = loaded;
    });
  }

  ngOnDestroy(): void {
    this.songsSub?.unsubscribe();
    this.peopleSub?.unsubscribe();
    this.peopleLoadedSub?.unsubscribe();
  }

  get filteredSongs(): Song[] {
    const needle = fold(this.activeQuery).trim();
    return this.songs
      .filter(song => !needle || this.matches(song, needle))
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  loadSongs(): void {
    this.status = 'loading';
    this.songsSub?.unsubscribe();
    this.songsSub = this.songsService.songs$.subscribe(
      songs => {
        this.songs = (songs || []).map(song => ({ ...song, leaderIds: song.leaderIds || [] }));
        this.status = 'ready';
      },
      () => (this.status = 'error'),
    );
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.activeQuery = value;
  }

  clearSearch(input: HTMLInputElement): void {
    this.onSearchInput('');
    input.focus();
  }

  toggleAddPanel(): void {
    this.showAddPanel = !this.showAddPanel;
    this.actionError = null;
  }

  async onParse(): Promise<void> {
    const text = this.pasteText;
    if (!this.peopleLoaded || !text.trim()) {
      return;
    }
    await this.openDraft(null, parseSongText(text, this.people));
  }

  async onFilesPicked(event: Event): Promise<void> {
    if (!this.peopleLoaded || this.importing) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    this.actionError = null;
    this.pickedFileCount = files.length;
    this.importing = true;
    // Failures collect across the whole pick: a later success must not
    // overwrite an earlier line, so the report lands after the loop.
    const failures: string[] = [];
    try {
      for (const file of files) {
        if (file.size === 0) {
          failures.push(`"${file.name}" is empty.`);
          continue;
        }
        if (file.size > MAX_IMPORT_BYTES) {
          failures.push(`"${file.name}" is larger than 2 MB.`);
          continue;
        }
        try {
          const text = await readFileText(file);
          if (!text.trim()) {
            failures.push(`"${file.name}" is empty.`);
            continue;
          }
          await this.openDraft(null, parseSongText(text, this.people));
        } catch {
          failures.push(`Couldn't read "${file.name}".`);
        }
      }
    } finally {
      if (failures.length > 1) {
        this.actionError =
          `We couldn't import ${failures.length} of ${files.length} files. ` +
          'Check that each one is a .txt file under 2 MB, then try again.';
      } else if (failures.length === 1) {
        this.actionError = failures[0];
      }
      this.importing = false;
    }
  }

  onEdit(song: Song): void {
    void this.openDraft(song, null);
  }

  async onDelete(song: Song): Promise<void> {
    this.actionError = null;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete song?',
      message: `Delete ${song.title}? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmTestId: 'admin-delete-confirm',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.songsService.deleteSong(song.id);
    } catch {
      this.actionError = `Couldn't delete "${song.title}". Please try again.`;
    }
  }

  leaderLabel(id: string): string {
    const person = this.peopleById.get(id);
    if (!person) {
      return 'Unknown';
    }
    const first = person.name.firstPreferred || person.name.firstGiven || 'Unknown';
    return person.name.last ? `${first} ${person.name.last}` : first;
  }

  formatUpdated(timestamp: number): string {
    return UPDATED_FORMAT.format(new Date(timestamp));
  }

  private openDraft(song: Song | null, parsed: ParsedSong | null): Promise<Song | null> {
    const ref = this.dialog.open<SongDraftDialogComponent, SongDraftDialogData, Song | null>(
      SongDraftDialogComponent,
      {
        data: { song, parsed, people: this.people },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '98vh',
        autoFocus: 'first-tabbable',
        // Escape/backdrop must never discard a typed draft; Cancel is the
        // explicit discard and the only close path while a save is in flight.
        disableClose: true,
      },
    );
    return firstValueFrom(ref.afterClosed()).then(result => result ?? null);
  }

  private matches(song: Song, needle: string): boolean {
    const haystack = [
      song.title,
      song.body,
      song.source || '',
      ...song.leaderIds.map(id => this.leaderLabel(id)),
    ].map(fold).join(' ');
    return haystack.includes(needle);
  }
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
