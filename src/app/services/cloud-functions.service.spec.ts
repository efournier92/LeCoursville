import { vi } from 'vitest';

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

describe('CloudFunctionsService', () => {
  let service: import('./cloud-functions.service').CloudFunctionsService;
  let ServiceClass: typeof import('./cloud-functions.service').CloudFunctionsService;
  let functionsSdk: any;
  let callable: any;
  const functions = { name: 'functions' };

  beforeAll(async () => {
    vi.resetModules();
    functionsSdk = await import('firebase/functions');
    const mod = await import('./cloud-functions.service');
    ServiceClass = mod.CloudFunctionsService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    callable = vi.fn();
    functionsSdk.httpsCallable.mockReturnValue(callable);
    service = new ServiceClass({ functions } as any);
  });

  it('appActionUrl is origin + /auth/action', () => {
    expect(service.appActionUrl()).toBe(window.location.origin + '/auth/action');
  });

  it('callable wrappers return .data', async () => {
    callable.mockResolvedValue({ data: { batchId: 'batch-1', objectsDeleted: 2 } });

    await expect(service.deleteMedia({ batchId: 'batch-1' } as any))
      .resolves.toEqual({ batchId: 'batch-1', objectsDeleted: 2 });
    expect(functionsSdk.httpsCallable).toHaveBeenCalledWith(functions, 'deleteMedia');
  });

  it('strips a trailing HTTP status from a callable error and keeps its code', async () => {
    const error = Object.assign(new Error('done [409]'), { code: 'already-exists' });
    callable.mockRejectedValue(error);

    const caught = await service.deleteMedia({ batchId: 'batch-1' } as any).catch((e: any) => e);

    expect(caught.message).toBe('done');
    expect(caught.code).toBe('already-exists');
  });

  it('leaves a callable error without a status token untouched', async () => {
    const error = Object.assign(new Error('done'), { code: 'already-exists' });
    callable.mockRejectedValue(error);

    const caught = await service.deleteMedia({ batchId: 'batch-1' } as any).catch((e: any) => e);

    expect(caught).toBe(error);
    expect(caught.message).toBe('done');
  });

  it('createUserUpload returns the server id and path', async () => {
    const input = {
      uploader: { anonymousId: 'anon-1' },
      fileName: 'file.png',
      fileType: 'image/png',
      fileSize: 10,
    };
    callable.mockResolvedValue({ data: { id: 'upload-1', path: 'userUploads/event/file.png' } });

    const result = await service.createUserUpload(input);

    expect(result).toEqual({ id: 'upload-1', path: 'userUploads/event/file.png' });
    expect(functionsSdk.httpsCallable).toHaveBeenCalledWith(functions, 'createUserUpload');
    expect(callable).toHaveBeenCalledWith(input);
  });
});
