import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PhotoAlbum } from '../models/photo-album';
import { RtdbService, RtdbListRef } from './rtdb.service';

@Injectable({ providedIn: 'root' })
export class PhotoAlbumsService {
  private readonly PHOTO_ALBUMS_PATH = 'photoAlbums';
  // Seed is null, not []: an empty array means "Firebase says zero albums"
  // (empty state), null means "not yet loaded" (skeleton). Emitting a []
  // seed made consumers flash the empty state before the first real
  // snapshot. Admin consumers already coerce falsy to [].
  private albumsSource: BehaviorSubject<PhotoAlbum[] | null> = new BehaviorSubject<PhotoAlbum[] | null>(null);
  public albums$: Observable<PhotoAlbum[] | null> = this.albumsSource.asObservable();

  constructor(private rtdb: RtdbService) {
    this.getAllAlbums().valueChanges().subscribe((albums: PhotoAlbum[]) => {
      this.albumsSource.next(albums);
    });
  }

  getAllAlbums(): RtdbListRef<PhotoAlbum> {
    return this.rtdb.list<PhotoAlbum>(this.PHOTO_ALBUMS_PATH);
  }

  getAlbum(id: string): Observable<PhotoAlbum | null> {
    return this.rtdb.object<PhotoAlbum>(`${this.PHOTO_ALBUMS_PATH}/${id}`).valueChanges();
  }

  async createAlbum(title: string): Promise<PhotoAlbum> {
    const id = this.rtdb.createPushId();
    const now = Date.now();
    const album: PhotoAlbum = { id, title, coverPhotoId: null, createdAt: now, updatedAt: now };
    await this.rtdb.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).set(album);
    return album;
  }

  async updateAlbum(id: string, partial: Partial<PhotoAlbum>): Promise<void> {
    await this.rtdb.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).update({ ...partial, updatedAt: Date.now() } as Record<string, unknown>);
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.rtdb.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).remove();
  }

  async deleteAlbumCascade(id: string, photoIds: string[]): Promise<void> {
    if (!photoIds || photoIds.length === 0) {
      await this.rtdb.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).remove();
      return;
    }
    const chunkSize = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < photoIds.length; i += chunkSize) {
      chunks.push(photoIds.slice(i, i + chunkSize));
    }
    for (let i = 0; i < chunks.length; i++) {
      const updates: Record<string, unknown> = {};
      if (i === 0) {
        updates[`${this.PHOTO_ALBUMS_PATH}/${id}`] = null;
      }
      for (const photoId of chunks[i]) {
        updates[`photos/${photoId}`] = null;
      }
      await this.rtdb.object('/').update(updates);
    }
  }

  createPushId(): string {
    return this.rtdb.createPushId();
  }
}
