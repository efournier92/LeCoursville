import { Injectable } from '@angular/core';
import { AngularFireDatabase, AngularFireList } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Address } from 'src/app/models/address';

@Injectable({
  providedIn: 'root'
})
export class AddressesService {
  private addressesSource: BehaviorSubject<Address[]> = new BehaviorSubject([]);
  addresses$: Observable<Address[]> = this.addressesSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getAddresses().valueChanges().subscribe(
      (addresses: Address[]) => {
        this.addressesSource.next(addresses);
      }
    );
  }

  getAddresses(): AngularFireList<Address> {
    return this.db.list('addresses');
  }

  getAddress(id: string): Observable<Address | null> {
    return this.db.object('addresses/' + id).valueChanges() as Observable<Address | null>;
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