import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NavbarLinksComponent } from './navbar-links.component';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { of } from 'rxjs';
import { FeatureFlag } from 'src/app/models/feature-flag';

describe('NavbarLinksComponent', () => {
  let component: NavbarLinksComponent;
  let fixture: ComponentFixture<NavbarLinksComponent>;
  let mockFeatureFlagsService: jasmine.SpyObj<FeatureFlagsService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FeatureFlagsService', ['getAllFeatureFlags']);
    spy.getAllFeatureFlags.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      declarations: [NavbarLinksComponent],
      providers: [
        { provide: FeatureFlagsService, useValue: spy },
      ]
    }).compileComponents();

    mockFeatureFlagsService = TestBed.inject(FeatureFlagsService) as jasmine.SpyObj<FeatureFlagsService>;
    fixture = TestBed.createComponent(NavbarLinksComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('when getAllFeatureFlags() returns { music: { enabled: false } }', () => {
    it('the Music button is not in filteredButtons', fakeAsync(() => {
      const flagsMap: Record<string, FeatureFlag | null> = {
        music: { enabled: false, updatedAt: Date.now() }
      };
      mockFeatureFlagsService.getAllFeatureFlags.and.returnValue(of(flagsMap));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const musicButton = component.filteredButtons.find(b => b.title === 'Music');
      expect(musicButton).toBeUndefined();
    }));
  });

  describe('when getAllFeatureFlags() returns {} (empty)', () => {
    it('all 7 toggleable buttons are present in filteredButtons', fakeAsync(() => {
      mockFeatureFlagsService.getAllFeatureFlags.and.returnValue(of({}));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const toggleableTitles = ['Expressions', 'Music', 'Videos', 'Calendar', 'Contacts', 'Photos', 'Chat'];
      const filteredToggleable = component.filteredButtons.filter(b =>
        toggleableTitles.includes(b.title)
      );
      expect(filteredToggleable.length).toBe(7);
    }));
  });

  describe('Account button behavior', () => {
    it('Account button is always present regardless of flags', fakeAsync(() => {
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
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const accountButton = component.filteredButtons.find(b => b.title === 'Account');
      expect(accountButton).toBeDefined();
      expect(accountButton.link).toBe('/');
    }));

    it('Account button maps to link === "/" and is never filtered', fakeAsync(() => {
      mockFeatureFlagsService.getAllFeatureFlags.and.returnValue(of({}));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const accountButton = component.buttons.find(b => b.link === '/');
      expect(accountButton.title).toBe('Account');
    }));
  });
});