import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';

@Component({
    selector: 'app-photo-shell',
    templateUrl: './photo-shell.component.html',
    styleUrls: ['./photo-shell.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PhotoShellComponent implements OnInit, OnDestroy {
  enablePhotoAlbums = false;
  private subscription: Subscription | null = null;

  constructor(private featureFlagsService: FeatureFlagsService) {}

  ngOnInit(): void {
    this.subscription = this.featureFlagsService.getAllFeatureFlags().subscribe(flags => {
      const flag = flags?.['enablePhotoAlbums'];
      this.enablePhotoAlbums = !!flag?.enabled;
    }, () => {
      // minimalist: the pre-resolution default already renders the legacy
      // photos page, so a failed flags stream fails open to working content.
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
