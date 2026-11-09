import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { JsonService } from 'src/app/services/json.service';
import { JsonValidationResponse } from 'src/app/models/json-validation-response';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';

type MediaSection = 'video' | 'audio' | 'photo-albums';

@Component({
    selector: 'app-admin-media',
    templateUrl: './admin-media.component.html',
    styleUrls: ['./admin-media.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminMediaComponent implements OnInit, OnDestroy {
  mediaTypes: string[] = ['Videos', 'Photos', 'Photo Album', 'Audio Track', 'Audio Album'];
  selectedMediaType: string;
  selectedFile: any;
  section: MediaSection = 'video';
  photoAlbumsEnabled = false;
  successMessages: string[] = [];
  errorMessages: string[] = [];
  driveFolderId = '';
  album: AudioAlbum = new AudioAlbum();
  private successSub: Subscription;
  private flagsSub: Subscription;

  constructor(
    private jsonService: JsonService,
    private route: ActivatedRoute,
    private router: Router,
    private featureFlagsService: FeatureFlagsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    // Deep link: /admin/photo-albums selects the album tab via route data;
    // ?section= wins so a selected tab survives reload and back navigation.
    const querySection = this.route.snapshot.queryParamMap.get('section');
    const dataSection = this.route.snapshot.data?.['mediaSection'];
    this.section = this.isSection(querySection)
      ? querySection
      : this.isSection(dataSection) ? dataSection : 'video';

    this.flagsSub = this.featureFlagsService.getAllFeatureFlags().subscribe(flags => {
      this.photoAlbumsEnabled = flags?.['enablePhotoAlbums']?.enabled === true;
      if (this.section === 'photo-albums' && !this.photoAlbumsEnabled) {
        this.section = 'video';
      }
    });

    // The source is a BehaviorSubject; skip its retained value so re-entering
    // the page does not replay a banner from an earlier visit.
    this.successSub = this.jsonService.successMessagesObservable.pipe(skip(1)).subscribe(
      (messages: string[]) => {
        this.successMessages = messages;
      }
    );
  }

  ngOnDestroy(): void {
    this.successSub?.unsubscribe();
    this.flagsSub?.unsubscribe();
  }

  // PUBLIC METHODS

  setSection(section: MediaSection): void {
    this.section = section;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      replaceUrl: true,
    });
  }

  private isSection(value: unknown): value is MediaSection {
    return value === 'video' || value === 'audio' || value === 'photo-albums';
  }

  dismissSuccess(message: string): void {
    this.successMessages = (this.successMessages || []).filter(m => m !== message);
  }

  dismissError(message: string): void {
    this.errorMessages = (this.errorMessages || []).filter(m => m !== message);
  }

  inputFileChangeEvent(files: any): void {
    this.clearMessages();
    this.selectedFile = files[0];
    const fileReader = new FileReader();
    fileReader.readAsText(this.selectedFile, 'UTF-8');
    fileReader.onload = () => {
      const jsonString = fileReader.result as string;
      this.parseJson(jsonString);
    };
    fileReader.onerror = (error) => {
      console.error(error);
    };
  }

  private clearMessages(): void {
    this.errorMessages = [];
    this.successMessages = [];
  }

  private parseJson(jsonString: string): void {
    const validationResponse = this.jsonService.isValidJson(jsonString);
    if (validationResponse.isValid) {
      const json = JSON.parse(jsonString);
      this.bulkUploadMedia(json);
    } else {
      validationResponse.message = 'ERROR: Uploaded file is not valid JSON.';
      this.printJsonErrors(validationResponse);
    }
  }

  private bulkUploadMedia(mediaArray: any) {
    if (!Array.isArray(mediaArray)) {
      const validationResponse = new JsonValidationResponse();
      validationResponse.message = 'ERROR: Uploaded JSON file is not an array.';
      this.printJsonErrors(validationResponse);
    }
    this.jsonService.bulkUploadMediaFromJson(mediaArray);
  }

  private printJsonErrors(validationResponse: JsonValidationResponse): void {
    if (!validationResponse) {
      return;
    }

    if (validationResponse.message) {
      this.errorMessages.push(validationResponse.message);
    }

    if (validationResponse.error && validationResponse.error.message) {
      this.errorMessages.push(validationResponse.error.message);
    }

    if (validationResponse.error && validationResponse.error.stack) {
      this.errorMessages.push(validationResponse.error.stack);
    }
  }
}
