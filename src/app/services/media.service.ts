import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFireDatabase, AngularFireList, AngularFireObject } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Media } from 'src/app/models/media/media';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { MediaTypesService } from './media-types-service.service';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  user: any;
  mediaList: AngularFireList<Media>;
  
  private mediaSource: BehaviorSubject<Media[]> = new BehaviorSubject<Media[]>([]);
  mediaObservable: Observable<Media[]> = this.mediaSource.asObservable();

  constructor(
    private db: AngularFireDatabase,
    private auth: AuthService,
    private mediaTypesService: MediaTypesService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user)
          this.user = user;
          
        this.getMedia().valueChanges().subscribe(
          (mediaList: Media[]) => {
            this.updateMediaEvent(mediaList);
          }
        );
      }
    )
  }

  updateMediaEvent(mediaFiles: Media[]): void {
    this.mediaSource.next(mediaFiles);
  }

  create(media: Media): void {
    if (!media || !media.id)
      media.id = this.db.createPushId();

    this.mediaList.update(media.id, media);
  }

  getMedia(): AngularFireList<Media> {
    this.mediaList = this.db.list('media');
    return this.mediaList;
  }

  getById(id: string): Observable<Media> {
    let mediaObj = this.db.object(`media/${id}`);
    const mediaByIdSource: BehaviorSubject<Media> = new BehaviorSubject<Media>(new Media());
    const mediaByIdObservable: Observable<Media> = mediaByIdSource.asObservable();

    function updateMediaEvent(media: Media): void {
      mediaByIdSource.next(media);
    }
    mediaObj.valueChanges().subscribe(
      (media: Media) => {
        if (media && media.id)
          updateMediaEvent(media);
      }
    )
    return mediaByIdObservable;
  }

  filterByTypes(selectedTypes: string[], allMedia: Media[]): Media[] {
    const hiddenTypes = this.mediaTypesService.getHiddenTypeIds();

    return allMedia.filter(
      (media: Media) => !hiddenTypes?.includes(media.type) && selectedTypes?.includes(media.type)
    );
  }

  filterByQuery(query: string, allMedia: Media[]): Media[] {
    return allMedia.filter(
      (media: Media) => {
        return this.doesAnyKeyIncludeQuery(media, query);
      }
    );
  }

  loadMoreMedia(numberToLoad: number, allMedia: Media[], loadedMedia: Media[]): Media[] {
    for (let i = 0; i < numberToLoad; i++) {
      loadedMedia = this.loadAnotherMediaFile(allMedia, loadedMedia);
    }

    return this.filterMedia(loadedMedia);
  }

  deleteMedia(media: Media): void {
    if (media?.listing?.length > 0) {
      media.listing.forEach((id: string) => {
        this.mediaList.remove(id);
      })
    }

    this.mediaList.remove(media.id);
  }

  loadAllMedia(type: string) {
    
  }

  private filterMedia(mediaList: Media[], ): Media[] {
    return mediaList.filter(media => !this.mediaTypesService.getHiddenTypeIds().includes(media.type));
  }

  private loadAnotherMediaFile(allMedia: Media[], loadedMedia: Media[]): Media[] {
    const newMedia = allMedia[loadedMedia.length];

    if (this.shouldLoadMediaFile(newMedia, allMedia, loadedMedia)) {
      loadedMedia.push(newMedia);
    }

    return loadedMedia;
  }

  private shouldLoadMediaFile(mediaFile: Media, allMedia: Media[], loadedMedia: Media[]): boolean {
    return loadedMedia.length < allMedia.length 
      && !loadedMedia.some(media => media.id === mediaFile.id)
  }

  private doesAnyKeyIncludeQuery(media: Media, query: string): boolean {
    return Object.keys(media).some(
      (key: string) => {
          let value = media[key];
          if (!this.isString(value))
            return;

          if (value)
            value = value.toLowerCase();

          if (query)
            query = query.toLowerCase();

          return value && value.includes(query);
    });
  }

  private isString(input: any) {
    return typeof input === "string";
  }

  tryLoadingFirstBatch(allMedia: Media[], loadedMedia: Media[]): Media[] {
    if (this.shouldLoadFirstBatch(allMedia, loadedMedia))
      loadedMedia = this.loadFirstBatch(allMedia, loadedMedia);

    return this.filterMedia(loadedMedia);
  }

  private shouldLoadFirstBatch(allMedia: Media[], loadedMedia: Media[]): boolean  {
    return allMedia.length && !loadedMedia.length;
  }

  private loadFirstBatch(allMedia: Media[], loadedMedia: Media[]): Media[] {
    return this.loadMoreMedia(10000, allMedia, loadedMedia);
  }

}
