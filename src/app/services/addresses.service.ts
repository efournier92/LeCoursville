import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Address } from 'src/app/models/address';

@Injectable({
  providedIn: 'root'
})
export class AddressesService {
  private addressesSource: BehaviorSubject<Address[]> = new BehaviorSubject([]);
  addresses$: Observable<Address[]> = this.addressesSource.asObservable();

  private addressMapSource: BehaviorSubject<Map<string, Address>> = new BehaviorSubject(new Map());
  addressMap$: Observable<Map<string, Address>> = this.addressMapSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getAddresses().snapshotChanges().pipe(
      map(changes => {
        const map = new Map<string, Address>();
        changes.forEach(c => {
          const data = c.payload.val() as Address;
          const key = c.payload.key as string;
          if (data) {
            data.id = key;
            map.set(key, data);
          }
        });
        return map;
      })
    ).subscribe(addressMap => {
      this.addressMapSource.next(addressMap);
      this.addressesSource.next(Array.from(addressMap.values()));
    });
  }

  getAddresses(): AngularFireList<Address> {
    return this.db.list('addresses');
  }

  getAddress(id: string): Observable<Address | null> {
    return this.db.object('addresses/' + id).valueChanges() as Observable<Address | null>;
  }

  getAddressMap(): Map<string, Address> {
    return this.addressMapSource.getValue();
  }

  saveAddress(address: Address): void {
    if (!address.id) {
      address.id = this.db.createPushId();
    }
    this.db.object('addresses/' + address.id).set(address);
  }

  updateAddress(id: string, data: Partial<Address>): void {
    this.db.object('addresses/' + id).update(data);
  }

  deleteAddress(id: string): void {
    this.db.object('addresses/' + id).remove();
  }
}