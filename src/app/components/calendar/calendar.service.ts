import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Calendar } from './calendar';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { finalize } from 'rxjs/operators';
import { AngularFireStorage } from '@angular/fire/storage';
import saveAs from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  calendars: AngularFireList<Calendar>;

  constructor(
    private storage: AngularFireStorage,
    private db: AngularFireDatabase,
  ) { 
      // this.auth.authState.subscribe(user => {
      // if (user) this.userId = user.uid;
      this.getCalendars().valueChanges().subscribe(
        (calendars: Calendar[]) => {
          this.updateCalendarsEvent(calendars);
        }
      );
    // });
  }

  private calendarsSource = new BehaviorSubject([]);
  calendarsObservable = this.calendarsSource.asObservable();

  updateCalendarsEvent(calendars: Calendar[]) {
    this.calendarsSource.next(calendars);
  }

  getCalendars() {
    return this.db.list('calendars', ref => ref.limitToFirst(1));
  }

  addCalendar(file: any) {
    let calendar = new Calendar();
    calendar.id = this.db.createPushId();
    calendar.path = `calendars/${calendar.id}.pdf`;
    
    const fileRef = this.storage.ref(calendar.path);
    const task = this.storage.upload(calendar.path, file);
    task.snapshotChanges().pipe(
        finalize(() => {
          fileRef.getDownloadURL().subscribe(
            url => {
              const calendarsDb = this.db.list(`calendars`);
              calendar.url = url;
              calendarsDb.set(calendar.id, calendar);
            }
          )
        })
      ).subscribe()
  }
}
