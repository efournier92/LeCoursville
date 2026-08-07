import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { RtdbService } from './rtdb.service';
import { RoutingService } from './routing.service';
import { PromptModalService } from './prompt-modal.service';

describe('AuthService', () => {
  let service: AuthService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'createPushId']);
    rtdbSpy.object.and.returnValue({
      valueChanges: () => of({ id: 'u1', name: 'Ada', roles: { user: true, admin: true } }),
      update: jasmine.createSpy('update'),
      set: jasmine.createSpy('set'),
      remove: jasmine.createSpy('remove'),
    });

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: RtdbService, useValue: rtdbSpy },
        { provide: RoutingService, useValue: jasmine.createSpyObj('RoutingService', ['NavigateToPromotedRoute', 'RefreshCurrentRoute', 'NavigateToRoute']) },
        { provide: PromptModalService, useValue: { openDialog: jasmine.createSpy('openDialog') } },
      ]
    });

    localStorage.clear();
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isUserSignedIn reads the cached user from localStorage', () => {
    expect(service.isUserSignedIn()).toBe(false);
    localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Ada' }));
    expect(service.isUserSignedIn()).toBe(true);
  });

  it('isUserAdmin is true only when the cached user has the admin role', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u1', roles: { admin: true } }));
    expect(service.isUserAdmin()).toBe(true);

    localStorage.setItem('user', JSON.stringify({ id: 'u2', roles: { admin: false } }));
    expect(service.isUserAdmin()).toBe(false);
  });

  it('updateUser emits the user, writes through RTDB and caches in localStorage', () => {
    const user = { id: 'u1', name: 'Ada', roles: { user: true, admin: true } };
    let emitted: any;
    service.userObservable.subscribe(u => (emitted = u));

    service.updateUser(user as any);

    expect(emitted).toBe(user);
    expect(rtdbSpy.object).toHaveBeenCalledWith('users/u1');
    expect(rtdbSpy.object('users/u1').update).toHaveBeenCalledWith(user);
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(user);
  });

  it('getUserNameById returns the name from the user record', () => {
    expect(service.getUserNameById('u1')).toBe('Ada');
    expect(rtdbSpy.object).toHaveBeenCalledWith('users/u1');
  });
});
