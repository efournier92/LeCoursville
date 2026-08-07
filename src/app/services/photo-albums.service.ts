import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { PhotoAlbum } from '../models/photo-album';

@Injectable({ providedIn: 'root' })
export class PhotoAlbumsService {
  private readonly PHOTO_ALBUMS_PATH = 'photoAlbums';
  private albumsSource: BehaviorSubject<PhotoAlbum[]> = new BehaviorSubject<PhotoAlbum[]>([]);
  public albums$: Observable<PhotoAlbum[]> = this.albumsSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getAllAlbums().valueChanges().subscribe((albums: PhotoAlbum[]) => {
      this.albumsSource.next(albums);
    });
  }

  getAllAlbums(): AngularFireList<PhotoAlbum> {
    return this.db.list(this.PHOTO_ALBUMS_PATH);
  }

  getAlbum(id: string): Observable<PhotoAlbum | null> {
    return this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).valueChanges() as Observable<PhotoAlbum | null>;
  }

  async createAlbum(title: string): Promise<PhotoAlbum> {
    const id = this.db.createPushId();
    const now = Date.now();
    const album: PhotoAlbum = { id, title, coverPhotoId: null, createdAt: now, updatedAt: now };
    await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).set(album);
    return album;
  }

  async updateAlbum(id: string, partial: Partial<PhotoAlbum>): Promise<void> {
    await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).update({ ...partial, updatedAt: Date.now() });
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).remove();
  }

  async deleteAlbumCascade(id: string, photoIds: string[]): Promise<void> {
    if (!photoIds || photoIds.length === 0) {
      await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).remove();
      return;
    }
    const chunkSize = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < photoIds.length; i += chunkSize) {
      chunks.push(photoIds.slice(i, i + chunkSize));
    }
    for (let i = 0; i < chunks.length; i++) {
      const updates: { [path: string]: null } = {};
      if (i === 0) {
        updates[`${this.PHOTO_ALBUMS_PATH}/${id}`] = null;
      }
      for (const photoId of chunks[i]) {
        updates[`photos/${photoId}`] = null;
      }
      await this.db.object('/').update(updates);
    }
  }

  createPushId(): string {
    return this.db.createPushId();
  }
}
