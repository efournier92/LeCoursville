import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { NavbarLinksComponent } from './navbar-links.component';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { of } from 'rxjs';
import { FeatureFlag } from 'src/app/models/feature-flag';

describe('NavbarLinksComponent', () => {
  let component: NavbarLinksComponent;
  let fixture: ComponentFixture<NavbarLinksComponent>;
  let mockFeatureFlagsService: jasmine.SpyObj<FeatureFlagsService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FeatureFlagsService', ['getAllFeatureFlags', 'flagsReady']);
    spy.flagsReady.and.returnValue(of(true));
    spy.getAllFeatureFlags.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [NavbarLinksComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: FeatureFlagsService, useValue: spy },
      ]
    }).compileComponents();

    mockFeatureFlagsService = TestBed.inject(FeatureFlagsService) as jasmine.SpyObj<FeatureFlagsService>;
    fixture = TestBed.createComponent(NavbarLinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('all core toggleable buttons are present when every flag defaults to enabled', () => {
    const toggleableTitles = ['Expressions', 'Music', 'Videos', 'Calendar', 'Contacts', 'Photos', 'Chat'];
    const filteredToggleable = component.filteredButtons.filter(b =>
      toggleableTitles.includes(b.title)
    );
    expect(filteredToggleable.length).toBe(7);
  });

  it('a feature flag set to disabled removes that button from filteredButtons', () => {
    const flagsMap: Record<string, FeatureFlag | null> = {
      music: { enabled: false, updatedAt: Date.now() }
    };
    mockFeatureFlagsService.getAllFeatureFlags.and.returnValue(of(flagsMap));
    component.ngOnInit();
    fixture.detectChanges();

    const musicButton = component.filteredButtons.find(b => b.title === 'Music');
    expect(musicButton).toBeUndefined();
    expect(component.filteredButtons.find(b => b.title === 'Calendar')).toBeDefined();
  });

  it('view-toggle flags (shared route) never become tabs and default to hidden', () => {
    // enablePhotoAlbums shares /photos with Photos and defaults OFF.
    const photoAlbumButton = component.buttons.find(b => b.title === 'Photo Albums (new view)');
    expect(photoAlbumButton).toBeUndefined();
  });

  it('Account button is always present regardless of flags', () => {
    const flagsMap: Record<string, FeatureFlag | null> = {
      expressions: { enabled: false, updatedAt: Date.now() },
      music: { enabled: false, updatedAt: Date.now() },
      videos: { enabled: false, updatedAt: Date.now() },
      calendar: { enabled: false, updatedAt: Date.now() },
      contacts: { enabled: false, updatedAt: Date.now() },
      photos: { enabled: false, updatedAt: Date.now() },
      chat: { enabled: false, updatedAt: Date.now() },
    };
    mockFeatureFlagsService.getAllFeatureFlags.and.returnValue(of(flagsMap));
    component.ngOnInit();
    fixture.detectChanges();

    const accountButton = component.filteredButtons.find(b => b.title === 'Account');
    expect(accountButton).toBeDefined();
    expect(accountButton!.link).toBe('/');
  });

  it('Account button maps to link === "/" and is never filtered', () => {
    const accountButton = component.buttons.find(b => b.link === '/');
    expect(accountButton).toBeDefined();
    expect(accountButton!.title).toBe('Account');
  });
});
