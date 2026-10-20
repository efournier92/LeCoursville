import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject, of } from 'rxjs';

import { AdminUserUploadsComponent } from './admin-user-uploads.component';
import { UserUploadService } from '../../services/user-upload.service';
import { PhotoAlbumsService } from '../../services/photo-albums.service';
import { FirebaseService } from '../../services/firebase.service';
import { AnalyticsService } from '../../services/analytics.service';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { MatDialog } from '@angular/material/dialog';
import { UserUpload } from '../../models/user-upload';

describe('AdminUserUploadsComponent', () => {
  let fixture: ComponentFixture<AdminUserUploadsComponent>;
  let component: AdminUserUploadsComponent;
  let uploads$: Subject<UserUpload[]>;
  let confirmSpy: jasmine.Spy;
  let approveUpload: jasmine.Spy;
  let rejectUpload: jasmine.Spy;

  const upload = (id: string, status: UserUpload['status'] = 'pending'): UserUpload => {
    const item = new UserUpload();
    item.id = id;
    item.fileName = `${id}.png`;
    item.status = status;
    item.fileType = 'image/png';
    return item;
  };

  beforeEach(async () => {
    uploads$ = new Subject<UserUpload[]>();
    confirmSpy = jasmine.createSpy('confirm').and.returnValue(Promise.resolve(false));
    approveUpload = jasmine.createSpy('approveUpload').and.returnValue(Promise.resolve());
    rejectUpload = jasmine.createSpy('rejectUpload').and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [AdminUserUploadsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: UserUploadService,
          useValue: {
            allUploads$: uploads$.asObservable(),
            approveUpload,
            rejectUpload,
          },
        },
        { provide: PhotoAlbumsService, useValue: { albums$: of([]) } },
        { provide: FirebaseService, useValue: { storage: {} } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: ConfirmDialogService, useValue: { confirm: confirmSpy } },
        { provide: AnalyticsService, useValue: { logEvent: jasmine.createSpy('logEvent') } },
        {
          provide: FeatureFlagsService,
          useValue: { getAllFeatureFlags: () => of({ enablePhotoAlbums: { enabled: false } }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUserUploadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows skeleton rows until uploads load', () => {
    expect(component.uploadsLoading).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.admin-skeleton-rows span').length).toBe(5);
    expect(fixture.nativeElement.querySelector('.admin-table')).toBeNull();
  });

  it('shows the caught-up empty state when nothing is pending', () => {
    uploads$.next([upload('approved-1', 'approved')]);
    fixture.detectChanges();
    expect(component.uploadsLoading).toBe(false);
    expect(fixture.nativeElement.querySelector('app-no-results-message')).not.toBeNull();
  });

  it('shows an error with retry when the upload stream fails', () => {
    uploads$.error(new Error('rtdb down'));
    fixture.detectChanges();
    expect(component.uploadsLoading).toBe(false);
    expect(fixture.nativeElement.querySelector('app-load-error')).not.toBeNull();
  });

  it('renders loaded uploads in the responsive table', () => {
    uploads$.next([upload('u1')]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.admin-table')).not.toBeNull();
    expect(el.querySelectorAll('td[data-label="File"]').length).toBe(1);
    expect(el.textContent).toContain('u1.png');
  });

  it('approves in one click', async () => {
    const target = upload('u1');
    uploads$.next([target]);
    fixture.detectChanges();

    await component.onApprove(target);
    expect(approveUpload).toHaveBeenCalledWith(target);
  });

  it('cancelling the reject confirmation keeps the upload', async () => {
    const target = upload('u1');
    uploads$.next([target]);
    fixture.detectChanges();

    await component.onReject(target);
    expect(confirmSpy).toHaveBeenCalled();
    expect(rejectUpload).not.toHaveBeenCalled();
  });

  it('confirming the reject dialog rejects the upload', async () => {
    const target = upload('u1');
    uploads$.next([target]);
    fixture.detectChanges();
    confirmSpy.and.returnValue(Promise.resolve(true));

    await component.onReject(target);
    expect(rejectUpload).toHaveBeenCalledWith(target);
  });

  it('paginates uploads at 10 per page and resets the page on filter change', () => {
    uploads$.next(Array.from({ length: 11 }, (_, i) => upload(`u${i}`)));
    fixture.detectChanges();
    expect(component.pageData.items.length).toBe(10);
    expect(component.pageData.pageCount).toBe(2);

    component.nextPage();
    fixture.detectChanges();
    expect(component.pageData.items.length).toBe(1);

    component.setFilter('all');
    expect(component.page).toBe(1);
  });
});
