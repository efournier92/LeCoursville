import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { RtdbService } from './rtdb.service';

describe('AdminService', () => {
  let service: AdminService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of([{ id: 'u1', name: 'Ada' }]) });
    rtdbSpy.createPushId.and.returnValue('push-1');
    rtdbSpy.object.and.returnValue({
      valueChanges: () => of(null),
      update: jasmine.createSpy('update'),
      remove: jasmine.createSpy('remove'),
      set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
    });

    TestBed.configureTestingModule({
      providers: [
        AdminService,
        { provide: AuthService, useValue: { userObservable: of({ id: 'admin-1' }) } },
        { provide: RtdbService, useValue: rtdbSpy },
      ]
    });

    service = TestBed.inject(AdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads all users into allUsersObservable on init', async () => {
    const users = await firstValueFrom(service.allUsersObservable);
    expect(users as any).toEqual([{ id: 'u1', name: 'Ada' }]);
  });

  it('updateAllUsersEvent broadcasts the new user list', async () => {
    service.updateAllUsersEvent([{ id: 'u2', name: 'Grace' }] as any);
    const users = await firstValueFrom(service.allUsersObservable);
    expect(users as any).toEqual([{ id: 'u2', name: 'Grace' }]);
  });

  it('updateUser delegates to the RTDB user record', () => {
    const user = { id: 'u1', name: 'Ada' };
    service.updateUser(user as any);
    expect(rtdbSpy.object).toHaveBeenCalledWith('users/u1');
    expect(rtdbSpy.object('users/u1').update).toHaveBeenCalledWith(user);
  });

  it('addRoleAudit writes one record under a fresh push id', async () => {
    const record = {
      actorId: 'admin-1',
      targetId: 'u1',
      targetEmail: 'ada@example.test',
      before: { admin: false, super: false },
      after: { admin: true, super: false },
      at: 1700000000000,
    };

    await service.addRoleAudit(record);

    expect(rtdbSpy.createPushId).toHaveBeenCalled();
    expect(rtdbSpy.object).toHaveBeenCalledWith('roleAudit/push-1');
    expect(rtdbSpy.object('roleAudit/push-1').set).toHaveBeenCalledWith(record);
  });

  it('deleteUser removes the RTDB user record', () => {
    service.deleteUser({ id: 'u1' } as any);
    expect(rtdbSpy.object).toHaveBeenCalledWith('/users/u1');
    expect(rtdbSpy.object('/users/u1').remove).toHaveBeenCalled();
  });
});
