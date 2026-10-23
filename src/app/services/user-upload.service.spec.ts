import { vi } from 'vitest';
import { UserUpload } from '../models/user-upload';

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  getBlob: vi.fn(),
  uploadBytes: vi.fn(),
  deleteObject: vi.fn(),
  getDownloadURL: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));

describe('UserUploadService', () => {
  let service: import('./user-upload.service').UserUploadService;
  let ServiceClass: typeof import('./user-upload.service').UserUploadService;
  let rxjs: typeof import('rxjs');
  let storage: any;
  let rtdbSpy: any;
  let photoAlbumsSpy: any;
  let cloudSpy: any;
  let refs: Record<string, any>;
  let maxUploadBytes: number;
  let maxUploadMessage: string;

  function upload(overrides: Partial<UserUpload> = {}): UserUpload {
    return Object.assign(new UserUpload(), {
      id: 'upload-1',
      path: 'userUploads/event/file.png',
      fileName: 'file.png',
      fileType: 'image/png',
      uploader: { anonymousId: 'anon-1' },
      ...overrides,
    });
  }

  beforeAll(async () => {
    vi.resetModules();
    rxjs = await import('rxjs');
    storage = await import('firebase/storage');
    const mod = await import('./user-upload.service');
    ServiceClass = mod.UserUploadService;
    maxUploadBytes = mod.MAX_UPLOAD_BYTES;
    maxUploadMessage = mod.MAX_UPLOAD_MESSAGE;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    storage.ref.mockImplementation((_storage: unknown, path: string) => ({ path }));
    storage.getBlob.mockResolvedValue(new Blob(['image']));
    storage.uploadBytes.mockResolvedValue({});
    storage.deleteObject.mockResolvedValue(undefined);
    storage.getDownloadURL.mockResolvedValue('https://download/photo');
    storage.uploadBytesResumable.mockReturnValue({ on: () => {} });

    refs = {};
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId', 'orderByChild', 'equalTo']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => rxjs.of([]) });
    rtdbSpy.createPushId.and.returnValue('photo-9');
    rtdbSpy.object.and.callFake((path: string) => {
      refs[path] ??= {
        valueChanges: () => rxjs.of(null),
        set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
        update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
        remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
      };
      return refs[path];
    });
    photoAlbumsSpy = jasmine.createSpyObj('PhotoAlbumsService', ['updateAlbum']);
    photoAlbumsSpy.updateAlbum.and.returnValue(Promise.resolve());
    cloudSpy = jasmine.createSpyObj('CloudFunctionsService', ['createUserUpload']);

    service = new ServiceClass(
      { storage: {} } as any,
      rtdbSpy,
      { logEvent: jasmine.createSpy('logEvent') } as any,
      photoAlbumsSpy,
      cloudSpy,
    );
  });

  it('safeSegment removes traversal and separators from a client-supplied value', () => {
    const safeSegment = (service as any).safeSegment.bind(service);

    expect(safeSegment('../..\\evil/file', 'fallback')).toBe('evil_file');
    expect(safeSegment('..', 'fallback')).toBe('fallback');
    expect(safeSegment('a\u0000b', 'fallback')).toBe('a_b');
    expect(safeSegment('..hidden..', 'fallback')).toBe('hidden');
  });

  it('safeSegment caps a segment at 120 characters', () => {
    const result = (service as any).safeSegment.call(service, 'a'.repeat(130), 'fallback');
    expect(result.length).toBe(120);
  });

  it('validatedUploadPath rejects a path outside uploads/', () => {
    const reject = () => (service as any).validatedUploadPath({ path: 'photos/album/file.png' });
    expect(reject).toThrowError('Upload path is outside the uploads folder.');

    const traversal = () => (service as any).validatedUploadPath({ path: 'userUploads/../file.png' });
    expect(traversal).toThrowError('Upload path is outside the uploads folder.');
  });

  it('destinationFileName rejects an unsafe file name', () => {
    expect(() => (service as any).destinationFileName('bad name.png'))
      .toThrowError('Unsafe upload file name: bad name.png');
  });

  it('uploadFile rejects a file over 50MB before creating an upload record', async () => {
    const file = { size: maxUploadBytes + 1, name: 'big.png', type: 'image/png' } as File;

    await expect(service.uploadFile(file, 'event', { anonymousId: 'anon-1' }))
      .rejects.toThrowError(maxUploadMessage);
    expect(cloudSpy.createUserUpload).not.toHaveBeenCalled();
  });

  it('approveUploadToAlbum links the photo to the album and marks the upload approved', async () => {
    cloudSpy.createUserUpload.and.returnValue(Promise.resolve({ id: 'upload-1', path: 'userUploads/event/file.png' }));

    await service.approveUploadToAlbum(upload(), 'album-1');

    const newPath = 'photos/album-1/photo-9_file.png';
    expect(storage.uploadBytes).toHaveBeenCalledWith(
      jasmine.objectContaining({ path: newPath }),
      jasmine.any(Blob),
      { contentType: 'image/png' },
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(jasmine.objectContaining({ path: 'userUploads/event/file.png' }));

    expect(refs['photos/photo-9'].set).toHaveBeenCalledWith(jasmine.objectContaining({
      id: 'photo-9',
      path: newPath,
      albumId: 'album-1',
      url: 'https://download/photo',
      uploadedBy: 'anon-1',
    }));
    expect(refs['userUploads/upload-1'].update).toHaveBeenCalledWith({
      status: 'approved',
      path: newPath,
      url: 'https://download/photo',
    });
    expect(photoAlbumsSpy.updateAlbum).toHaveBeenCalledWith('album-1', {});
  });

  it('rejectUpload deletes the stored object before the upload record', async () => {
    const order: string[] = [];
    storage.deleteObject.mockImplementation(() => {
      order.push('storage');
      return Promise.resolve();
    });
    refs['userUploads/upload-1'] = {
      remove: jasmine.createSpy('remove').and.callFake(() => {
        order.push('record');
        return Promise.resolve();
      }),
    };

    await service.rejectUpload(upload());

    expect(order).toEqual(['storage', 'record']);
  });

  it('deleteUpload removes both the stored object and the upload record', async () => {
    await service.deleteUpload(upload());

    expect(storage.deleteObject).toHaveBeenCalledWith(jasmine.objectContaining({ path: 'userUploads/event/file.png' }));
    expect(refs['userUploads/upload-1'].remove).toHaveBeenCalled();
  });
});
