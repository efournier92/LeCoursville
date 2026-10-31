import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Person } from 'src/app/models/person';
import { Song } from 'src/app/models/song';
import { ParsedSong } from 'src/app/services/song-parser';
import { SongsService } from 'src/app/services/songs.service';

export interface SongDraftDialogData {
  song: Song | null;
  parsed: ParsedSong | null;
  people: Person[];
}

/** Case- and diacritic-insensitive fold shared with parser and member search. */
function fold(value: string | null | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

@Component({
  selector: 'app-song-draft-dialog',
  templateUrl: './song-draft-dialog.component.html',
  styleUrls: ['./song-draft-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SongDraftDialogComponent {
  title = '';
  source = '';
  musicalKey = '';
  body = '';
  leaderSearch = '';
  selectedLeaderIds: string[] = [];
  unmatchedLeaders: string[] = [];
  saving = false;
  error: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<SongDraftDialogComponent, Song | null>,
    @Inject(MAT_DIALOG_DATA) public data: SongDraftDialogData,
    private songsService: SongsService,
  ) {
    if (data.song) {
      this.title = data.song.title;
      this.source = data.song.source || '';
      this.musicalKey = data.song.musicalKey || '';
      this.body = data.song.body;
      this.selectedLeaderIds = [...(data.song.leaderIds || [])];
    } else if (data.parsed) {
      this.title = data.parsed.title;
      this.source = data.parsed.source || '';
      this.musicalKey = data.parsed.musicalKey || '';
      this.body = data.parsed.body;
      this.selectedLeaderIds = [...data.parsed.leaderIds];
      this.unmatchedLeaders = [...data.parsed.unmatchedLeaders];
    }
  }

  get filteredPeople(): Person[] {
    const needle = fold(this.leaderSearch).trim();
    return this.data.people.filter(person => !needle || fold(this.personName(person)).includes(needle));
  }

  personName(person: Person): string {
    const first = person.name.firstPreferred || person.name.firstGiven || 'Unknown';
    return person.name.last ? `${first} ${person.name.last}` : first;
  }

  leaderLabel(id: string): string {
    const person = this.data.people.find(item => item.id === id);
    return person ? this.personName(person) : 'Unknown';
  }

  isSelected(id: string): boolean {
    return this.selectedLeaderIds.includes(id);
  }

  toggleLeader(id: string): void {
    if (this.isSelected(id)) {
      this.removeLeader(id);
    } else {
      this.selectedLeaderIds = [...this.selectedLeaderIds, id];
    }
  }

  removeLeader(id: string): void {
    this.selectedLeaderIds = this.selectedLeaderIds.filter(item => item !== id);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  async onSave(): Promise<void> {
    if (this.saving) {
      return;
    }
    const title = this.title.trim();
    const source = this.source.trim();
    const musicalKey = this.musicalKey.trim();
    const body = this.body;

    if (!title) {
      this.error = 'Title is required.';
      return;
    }
    if (title.length > 200) {
      this.error = 'Title must be 200 characters or fewer.';
      return;
    }
    if (!body.trim()) {
      this.error = 'Lyrics are required.';
      return;
    }
    if (body.length > 100000) {
      this.error = 'Lyrics must be 100,000 characters or fewer.';
      return;
    }
    if (source.length > 200) {
      this.error = 'Source must be 200 characters or fewer.';
      return;
    }
    if (musicalKey.length > 16) {
      this.error = 'Key must be 16 characters or fewer.';
      return;
    }

    this.saving = true;
    this.error = null;
    const leaderIds = [...new Set(this.selectedLeaderIds)];
    const song: Song = {
      id: this.data.song?.id || crypto.randomUUID(),
      title,
      body,
      source: source || null,
      musicalKey: musicalKey || null,
      leaderIds,
      createdAt: this.data.song?.createdAt || 0,
      updatedAt: 0,
    };

    try {
      if (this.data.song) {
        await this.songsService.updateSong(song.id, {
          title: song.title,
          body: song.body,
          source: song.source,
          musicalKey: song.musicalKey,
          leaderIds: song.leaderIds,
        });
      } else {
        await this.songsService.saveSong(song);
      }
      this.dialogRef.close(song);
    } catch (error) {
      this.error =
        error instanceof Error && error.message === 'Song no longer exists.'
          ? error.message
          : 'Couldn’t save this song. Please try again.';
    } finally {
      this.saving = false;
    }
  }
}
