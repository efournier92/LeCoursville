import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Song } from 'src/app/models/song';
import { Person } from 'src/app/models/person';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { PeopleService } from 'src/app/services/people.service';
import { SongsService } from 'src/app/services/songs.service';

/** Case- and diacritic-insensitive fold shared by search and parser semantics. */
function fold(value: string | null | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Chord-over tokens: root, optional accidental and quality/suspension, slash bass. */
const CHORD_TOKEN = /^[A-G][#b]?(?:maj|min|m|dim|aug|sus|add|M|°|ø|\d)*(?:\/[A-G][#b]?)?$/;

/** A line whose every token is a chord name carries no lyric to preview. */
function isChordOnlyLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(token => CHORD_TOKEN.test(token.replace(/[()]/g, '')));
}

@Component({
  selector: 'app-songs-list',
  templateUrl: './songs-list.component.html',
  styleUrls: ['./songs-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SongsListComponent implements OnInit, OnDestroy {
  songs: Song[] = [];
  peopleById = new Map<string, Person>();
  searchTerm = '';
  activeQuery = '';
  status: 'loading' | 'error' | 'ready' = 'loading';
  skeletonIterations = [1, 2, 3, 4, 5, 6];

  user: User | null = null;

  private songsSub: Subscription | null = null;
  private peopleSub: Subscription | null = null;
  private userSub: Subscription | null = null;
  private searchSub: Subscription | null = null;
  private searchTerms = new Subject<string>();

  constructor(
    private songsService: SongsService,
    private peopleService: PeopleService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.searchSub = this.searchTerms.pipe(
      debounceTime(200),
      distinctUntilChanged(),
    ).subscribe(term => (this.activeQuery = term));

    this.peopleSub = this.peopleService.people$.subscribe(people => {
      this.peopleById = new Map(people.map(person => [person.id, person]));
    });

    this.userSub = this.authService.userObservable.subscribe((user: User) => {
      this.user = user;
    });

    this.loadSongs();
  }

  ngOnDestroy(): void {
    this.songsSub?.unsubscribe();
    this.peopleSub?.unsubscribe();
    this.userSub?.unsubscribe();
    this.searchSub?.unsubscribe();
  }

  get isAdmin(): boolean {
    return this.user?.roles?.admin === true || this.user?.roles?.super === true;
  }

  get filteredSongs(): Song[] {
    const needle = fold(this.activeQuery).trim();
    return this.songs
      .filter(song => !needle || this.matches(song, needle))
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchTerms.next(value);
  }

  clearSearch(input: HTMLInputElement): void {
    this.onSearchInput('');
    input.focus();
  }

  retry(): void {
    this.loadSongs();
  }

  leaderLabel(id: string, includeLast = false): string {
    const person = this.peopleById.get(id);
    if (!person) {
      return 'Unknown';
    }
    const first = person.name.firstPreferred || person.name.firstGiven || 'Unknown';
    return includeLast && person.name.last ? `${first} ${person.name.last}` : first;
  }

  isResolved(id: string): boolean {
    return this.peopleById.has(id);
  }

  excerpt(song: Song): string {
    // The card preview reads as lyrics; the detail keeps the chord brackets.
    const candidates = song.body
      .split('\n')
      .map(line => {
        const text = line.replace(/\[[^\]]*\]/g, '').trim();
        return { text, chordOnly: isChordOnlyLine(text) };
      })
      .filter(entry => entry.text.length > 0);

    // Every chord-only line is sheet notation, not a lyric, so none of them
    // enters the preview pool — only the first two lyric lines are shown.
    const lyrics = candidates.filter(entry => !entry.chordOnly);
    return lyrics.slice(0, 2).map(entry => entry.text).join('\n');
  }

  private matches(song: Song, needle: string): boolean {
    const haystack = [
      song.title,
      song.body,
      song.source || '',
      ...song.leaderIds.map(id => this.leaderLabel(id, true)),
    ].map(fold).join(' ');
    return haystack.includes(needle);
  }

  private loadSongs(): void {
    this.status = 'loading';
    this.songsSub?.unsubscribe();
    this.songsSub = this.songsService.songs$.subscribe(
      songs => {
        // RTDB drops empty arrays and nulls, so absent optionals arrive undefined.
        this.songs = songs.map(song => ({ ...song, leaderIds: song.leaderIds || [] }));
        this.status = 'ready';
      },
      () => (this.status = 'error'),
    );
  }
}
