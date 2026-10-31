import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Song } from 'src/app/models/song';
import { Person } from 'src/app/models/person';
import { PeopleService } from 'src/app/services/people.service';
import { hasBracketChords, segmentSongBody, SongLine, transposeBody, transposeKeyName } from 'src/app/services/chord-transpose';
import { SongsService } from 'src/app/services/songs.service';

@Component({
  selector: 'app-song-detail',
  templateUrl: './song-detail.component.html',
  styleUrls: ['./song-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SongDetailComponent implements OnInit, OnDestroy {
  songId = '';
  song: Song | null = null;
  peopleById = new Map<string, Person>();
  offset = 0;
  status: 'loading' | 'error' | 'notfound' | 'ready' = 'loading';

  /** True once the user has transposed; keeps the live region silent on load. */
  private hasTransposed = false;

  private songSub: Subscription | null = null;
  private peopleSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private songsService: SongsService,
    private peopleService: PeopleService,
  ) {}

  ngOnInit(): void {
    this.songId = this.route.snapshot.paramMap.get('id') || '';
    this.peopleSub = this.peopleService.people$.subscribe(people => {
      this.peopleById = new Map(people.map(person => [person.id, person]));
    });
    this.loadSong();
  }

  ngOnDestroy(): void {
    this.songSub?.unsubscribe();
    this.peopleSub?.unsubscribe();
  }

  get displayBody(): string {
    return this.song ? transposeBody(this.song.body, this.offset) : '';
  }

  /** Same transposed body, split for span rendering; never injected as HTML. */
  get bodyLines(): SongLine[] {
    return segmentSongBody(this.displayBody);
  }

  /** Empty at 0 so the badge disappears while its live region stays mounted. */
  get offsetLabel(): string {
    if (this.offset === 0) {
      return '';
    }
    return `${this.offset > 0 ? '+' : ''}${this.offset}`;
  }

  /**
   * Screen-reader sentence behind the visual badge: direction, count, and the
   * key change. Stays empty until the user transposes so the mounted live
   * region never announces on page load; a reset announces its own result.
   */
  get offsetAnnouncement(): string {
    const storedKey = this.song?.musicalKey || '';
    if (this.offset === 0) {
      if (!this.hasTransposed) {
        return '';
      }
      return storedKey ? `Transpose reset; key ${storedKey}` : 'Transpose reset';
    }
    const count = Math.abs(this.offset);
    const direction = this.offset > 0 ? 'up' : 'down';
    const semitones = `${count} semitone${count === 1 ? '' : 's'}`;
    const transposedKey = storedKey ? transposeKeyName(storedKey, this.offset) : null;
    const keyChange = storedKey
      ? transposedKey
        ? `; key ${storedKey} → ${transposedKey}`
        : `; key ${storedKey}`
      : '';
    return `Transposed ${direction} ${semitones}${keyChange}`;
  }

  /** Stored key, followed by the transposed key when the note parses. */
  get displayKey(): string | null {
    if (!this.song?.musicalKey) {
      return null;
    }
    const transposed = this.offset === 0
      ? null
      : transposeKeyName(this.song.musicalKey, this.offset);
    return transposed ? `${this.song.musicalKey} → ${transposed}` : this.song.musicalKey;
  }

  get showTranspose(): boolean {
    return !!this.song && hasBracketChords(this.song.body);
  }

  transpose(delta: number): void {
    this.offset = Math.max(-11, Math.min(11, this.offset + delta));
    this.hasTransposed = true;
  }

  reset(): void {
    this.offset = 0;
    this.hasTransposed = true;
  }

  retry(): void {
    this.loadSong();
  }

  leaderLabel(id: string): string {
    const person = this.peopleById.get(id);
    if (!person) {
      return 'Unknown';
    }
    const first = person.name.firstPreferred || person.name.firstGiven || 'Unknown';
    return person.name.last ? `${first} ${person.name.last}` : first;
  }

  isResolved(id: string): boolean {
    return this.peopleById.has(id);
  }

  private loadSong(): void {
    this.status = 'loading';
    this.offset = 0;
    this.hasTransposed = false;
    this.songSub?.unsubscribe();
    this.songSub = this.songsService.getSong(this.songId).subscribe(
      song => {
        // RTDB drops empty arrays and nulls, so absent optionals arrive undefined.
        this.song = song ? { ...song, leaderIds: song.leaderIds || [] } : null;
        this.status = song ? 'ready' : 'notfound';
      },
      () => (this.status = 'error'),
    );
  }
}
