import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AddressesService } from './addresses.service';
import { Address } from 'src/app/models/address';
import { RtdbService } from './rtdb.service';

describe('AddressesService', () => {
  let service: AddressesService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let refs: Record<string, any>;

  beforeEach(() => {
    refs = {};
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({
      snapshotChanges: () => of([{ key: 'a1', value: { full: '1 Main St' } }]),
      valueChanges: () => of([]),
    });
    rtdbSpy.createPushId.and.returnValue('push-1');
    rtdbSpy.object.and.callFake((path: string) => {
      refs[path] ??= {
        valueChanges: () => of(null),
        set: jasmine.createSpy('set'),
        update: jasmine.createSpy('update'),
        remove: jasmine.createSpy('remove'),
      };
      return refs[path];
    });

    TestBed.configureTestingModule({
      providers: [
        AddressesService,
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });
    service = TestBed.inject(AddressesService);
  });

  it('maps snapshot keys onto the address id', async () => {
    const map = await firstValueFrom(service.addressMap$);

    expect(map.get('a1').id).toBe('a1');
    expect(service.getAddressMap().get('a1').full).toBe('1 Main St');
  });

  it('saveAddress assigns a push id when the address has none', () => {
    const address = { full: '2 Main St' } as Address;

    service.saveAddress(address);

    expect(rtdbSpy.createPushId).toHaveBeenCalled();
    expect(refs['addresses/push-1'].set).toHaveBeenCalledWith(address);
    expect(address.id).toBe('push-1');
  });

  it('saveAddress writes an existing id', () => {
    const address = { id: 'a1', full: '3 Main St' } as Address;

    service.saveAddress(address);

    expect(refs['addresses/a1'].set).toHaveBeenCalledWith(address);
  });

  it('updates and deletes by id', () => {
    service.updateAddress('a1', { city: 'Albany' });
    service.deleteAddress('a1');

    expect(refs['addresses/a1'].update).toHaveBeenCalledWith({ city: 'Albany' });
    expect(refs['addresses/a1'].remove).toHaveBeenCalled();
  });
});
