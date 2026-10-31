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
  skeletonIterations = [1, 2, 3, 4, 5, 6];

  private songsSub: Subscription | null = null;
  private peopleSub: Subscription | null = null;
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
  }

  ngOnDestroy(): void {
    this.songsSub?.unsubscribe();
    this.peopleSub?.unsubscribe();
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
    if (!text.trim()) {
      return;
    }
    await this.openDraft(null, parseSongText(text, this.people));
  }

  async onFilesPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    this.actionError = null;
    this.pickedFileCount = files.length;
    for (const file of files) {
      try {
        const text = await readFileText(file);
        await this.openDraft(null, parseSongText(text, this.people));
      } catch {
        this.actionError = `Couldn’t read “${file.name}”.`;
      }
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
      this.actionError = `Couldn’t delete “${song.title}”. Please try again.`;
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
        autoFocus: 'first-tabbable',
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
