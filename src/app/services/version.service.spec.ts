import { TestBed } from '@angular/core/testing';

import { VersionService } from './version.service';

describe('VersionService', () => {
  let service: VersionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VersionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAppVersion returns a semver string from package.json', () => {
    expect(service.getAppVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('writeVersionToWindow stores the version on window', () => {
    service.writeVersionToWindow();
    expect((window as any).version).toBe(service.getAppVersion());
  });
});
