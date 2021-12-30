import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { UploadableMedia } from 'src/app/models/media/media';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { MediaTypesService } from './media-types-service.service';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  user: any;
  mediaList: AngularFireList<UploadableMedia>;

  private mediaSource: BehaviorSubject<UploadableMedia[]> = new BehaviorSubject<UploadableMedia[]>([]);
  mediaObservable: Observable<UploadableMedia[]> = this.mediaSource.asObservable();
  allMedia: UploadableMedia[];

  constructor(
    private db: AngularFireDatabase,
    private auth: AuthService,
    private mediaTypesService: MediaTypesService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user) {
          this.user = user;
        }

        this.getMedia().valueChanges().subscribe(
          (mediaList: UploadableMedia[]) => {
            this.allMedia = mediaList;
            this.updateMediaEvent(mediaList);
          }
        );
      }
    );
  }

  updateMediaEvent(mediaFiles: UploadableMedia[]): void {
    this.mediaSource.next(mediaFiles);
  }

  create(media: UploadableMedia): void {
    if (!media || !media.id) {
      media.id = this.db.createPushId();
    }

    this.mediaList.update(media.id, media);
  }

  getMedia(): AngularFireList<UploadableMedia> {
    this.mediaList = this.db.list('media');
    return this.mediaList;
  }

  getMediaById(id: string): UploadableMedia {
    return this.allMedia.find(x => x.id === id);
  }

  filterByTypes(selectedTypes: string[], allMedia: UploadableMedia[]): UploadableMedia[] {
    const hiddenTypes = this.mediaTypesService.getHiddenTypeIds();

    return allMedia.filter(
      (media: UploadableMedia) => !hiddenTypes?.includes(media.type) && selectedTypes?.includes(media.type)
    );
  }

  filterByQuery(query: string, allMedia: UploadableMedia[]): UploadableMedia[] {
    return allMedia.filter(
      (media: UploadableMedia) => {
        return this.doesAnyKeyIncludeQuery(media, query);
      }
    );
  }

  loadMoreMedia(numberToLoad: number, allMedia: UploadableMedia[], loadedMedia: UploadableMedia[]): UploadableMedia[] {
    for (let i = 0; i < numberToLoad; i++) {
      loadedMedia = this.loadAnotherMediaFile(allMedia, loadedMedia);
    }

    return this.filterMedia(loadedMedia);
  }

  deleteMedia(media: UploadableMedia): void {
    if (media?.listing?.length > 0) {
      media.listing.forEach((id: string) => {
        this.mediaList.remove(id);
      });
    }

    this.mediaList.remove(media.id);
  }

  loadAllMedia(type: string) {

  }

  private filterMedia(mediaList: UploadableMedia[], ): UploadableMedia[] {
    return mediaList.filter(media => !this.mediaTypesService.getHiddenTypeIds().includes(media.type));
  }

  private loadAnotherMediaFile(allMedia: UploadableMedia[], loadedMedia: UploadableMedia[]): UploadableMedia[] {
    const newMedia = allMedia[loadedMedia.length];

    if (this.shouldLoadMediaFile(newMedia, allMedia, loadedMedia)) {
      loadedMedia.push(newMedia);
    }

    return loadedMedia;
  }

  private shouldLoadMediaFile(mediaFile: UploadableMedia, allMedia: UploadableMedia[], loadedMedia: UploadableMedia[]): boolean {
    return loadedMedia.length < allMedia.length
      && !loadedMedia.some(media => media.id === mediaFile.id);
  }

  private doesAnyKeyIncludeQuery(media: UploadableMedia, query: string): boolean {
    return Object.keys(media).some(
      (key: string) => {
          let value = media[key];
          if (!this.isString(value)) {
            return;
          }

          if (value) {
            value = value.toLowerCase();
          }

          if (query) {
            query = query.toLowerCase();
          }

          return value && value.includes(query);
    });
  }

  private isString(input: any) {
    return typeof input === 'string';
  }

  tryLoadingFirstBatch(allMedia: UploadableMedia[], loadedMedia: UploadableMedia[]): UploadableMedia[] {
    if (this.shouldLoadFirstBatch(allMedia, loadedMedia)) {
      loadedMedia = this.loadFirstBatch(allMedia, loadedMedia);
    }

    return this.filterMedia(loadedMedia);
  }

  private shouldLoadFirstBatch(allMedia: UploadableMedia[], loadedMedia: UploadableMedia[]): boolean  {
    return allMedia.length && !loadedMedia.length;
  }

  private loadFirstBatch(allMedia: UploadableMedia[], loadedMedia: UploadableMedia[]): UploadableMedia[] {
    return this.loadMoreMedia(10000, allMedia, loadedMedia);
  }
}
