import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Address } from 'src/app/models/address';
import { RtdbService } from './rtdb.service';

@Injectable({
  providedIn: 'root'
})
export class AddressesService {
  private addressesSource: BehaviorSubject<Address[]> = new BehaviorSubject([]);
  addresses$: Observable<Address[]> = this.addressesSource.asObservable();

  private addressMapSource: BehaviorSubject<Map<string, Address>> = new BehaviorSubject(new Map());
  addressMap$: Observable<Map<string, Address>> = this.addressMapSource.asObservable();

  constructor(
    private rtdb: RtdbService,
  ) {
    this.rtdb.list<Address>('addresses').snapshotChanges<Address>().pipe(
      map(changes => {
        const map = new Map<string, Address>();
        changes.forEach(c => {
          const data = c.value;
          if (data) {
            data.id = c.key;
            map.set(c.key, data);
          }
        });
        return map;
      })
    ).subscribe(addressMap => {
      this.addressMapSource.next(addressMap);
      this.addressesSource.next(Array.from(addressMap.values()));
    });
  }

  getAddress(id: string): Observable<Address | null> {
    return this.rtdb.object<Address>('addresses/' + id).valueChanges();
  }

  getAddressMap(): Map<string, Address> {
    return this.addressMapSource.getValue();
  }

  saveAddress(address: Address): void {
    if (!address.id) {
      address.id = this.rtdb.createPushId();
    }
    this.rtdb.object('addresses/' + address.id).set(address);
  }

  updateAddress(id: string, data: Partial<Address>): void {
    this.rtdb.object('addresses/' + id).update(data);
  }

  deleteAddress(id: string): void {
    this.rtdb.object('addresses/' + id).remove();
  }
}
