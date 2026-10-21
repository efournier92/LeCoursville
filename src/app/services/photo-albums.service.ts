import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
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
  private errorSource: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public error$: Observable<boolean> = this.errorSource.asObservable();
  private albumsSubscription: Subscription | null = null;

  constructor(private rtdb: RtdbService) {
    this.reload();
  }

  /** Re-subscribes to the album stream after a transient failure. */
  reload(): void {
    this.albumsSubscription?.unsubscribe();
    this.albumsSource.next(null);
    this.errorSource.next(false);
    // A failed listener ends on its own; handling the error here leaves the
    // shared subject open so reload() can re-subscribe.
    this.albumsSubscription = this.getAllAlbums().valueChanges().subscribe({
      next: albums => this.albumsSource.next(Array.isArray(albums) ? albums : []),
      error: () => this.errorSource.next(true),
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
    // Not atomic: removals are chunked, so a mid-way failure can leave a partial album.
    // True atomicity needs a Cloud Function (out of scope).
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
