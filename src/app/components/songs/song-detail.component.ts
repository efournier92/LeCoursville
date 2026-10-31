import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Song } from 'src/app/models/song';
import { Person } from 'src/app/models/person';
import { PeopleService } from 'src/app/services/people.service';
import { hasBracketChords, transposeBody } from 'src/app/services/chord-transpose';
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

  get showTranspose(): boolean {
    return !!this.song && hasBracketChords(this.song.body);
  }

  transpose(delta: number): void {
    this.offset = Math.max(-11, Math.min(11, this.offset + delta));
  }

  reset(): void {
    this.offset = 0;
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
