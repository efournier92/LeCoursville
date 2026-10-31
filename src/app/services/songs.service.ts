import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { Song } from 'src/app/models/song';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class SongsService {
  songs$: Observable<Song[]>;

  constructor(private rtdb: RtdbService) {
    this.songs$ = this.rtdb.list<Song>('songs').valueChanges();
  }

  getSong(id: string): Observable<Song | null> {
    return this.rtdb.object<Song>('songs/' + id).valueChanges();
  }

  async saveSong(song: Song): Promise<void> {
    const now = Date.now();
    const record: Song = {
      ...song,
      createdAt: song.createdAt || now,
      updatedAt: now,
    };
    await this.rtdb.object<Song>('songs/' + song.id).set(record);
  }

  async updateSong(id: string, patch: Partial<Song>): Promise<void> {
    const ref = this.rtdb.object<Song>('songs/' + id);
    // Firebase `update` upserts, so a draft saved after another admin deleted
    // the song would resurrect a partial record. Read first and refuse.
    const existing = await firstValueFrom(ref.valueChanges());
    if (!existing) {
      throw new Error('Song no longer exists.');
    }
    await ref.update({ ...patch, updatedAt: Date.now() });
  }

  async deleteSong(id: string): Promise<void> {
    await this.rtdb.object<Song>('songs/' + id).remove();
  }
}
