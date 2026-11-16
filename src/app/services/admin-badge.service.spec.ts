import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AdminBadgeService } from './admin-badge.service';
import { RtdbService } from './rtdb.service';

describe('AdminBadgeService', () => {
  let service: AdminBadgeService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['list', 'orderByChild', 'equalTo']);
    rtdbSpy.orderByChild.and.returnValue('orderByChild' as any);
    rtdbSpy.equalTo.and.returnValue('equalTo' as any);

    TestBed.configureTestingModule({
      providers: [
        AdminBadgeService,
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });
    service = TestBed.inject(AdminBadgeService);
  });

  it('pendingUploads counts pending upload rows', async () => {
    rtdbSpy.list.and.returnValue({
      valueChanges: () => of([{ status: 'pending' }, { status: 'pending' }]),
    });

    expect(await firstValueFrom(service.pendingUploads())).toBe(2);
    expect(rtdbSpy.orderByChild).toHaveBeenCalledWith('status');
    expect(rtdbSpy.equalTo).toHaveBeenCalledWith('pending');
    expect(rtdbSpy.list).toHaveBeenCalledWith('userUploads', ['orderByChild', 'equalTo']);
  });

  it('outstandingRecoveryRequests sums open and pending rows', async () => {
    rtdbSpy.equalTo.and.callFake((status: string) => status as any);
    rtdbSpy.list.and.callFake((_path: string, query: any[]) => ({
      valueChanges: () => of(
        query[1] === 'open'
          ? [{ status: 'open' }, { status: 'open' }]
          : [{ status: 'pending' }],
      ),
    }));

    expect(await firstValueFrom(service.outstandingRecoveryRequests())).toBe(3);
    expect(rtdbSpy.equalTo).toHaveBeenCalledWith('open');
    expect(rtdbSpy.equalTo).toHaveBeenCalledWith('pending');
    expect(rtdbSpy.list).toHaveBeenCalledWith('recoveryRequests', ['orderByChild', 'open']);
    expect(rtdbSpy.list).toHaveBeenCalledWith('recoveryRequests', ['orderByChild', 'pending']);
  });
});
