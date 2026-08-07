import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { FileDownloadService } from './file-download.service';

describe('FileDownloadService', () => {
  let service: FileDownloadService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(FileDownloadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('download fetches the url as a blob', () => {
    const blob = new Blob(['data'], { type: 'application/pdf' });
    let received: Blob | undefined;

    service.download('https://example.com/file.pdf').subscribe(b => (received = b));

    const req = httpMock.expectOne('https://example.com/file.pdf');
    expect(req.request.responseType).toBe('blob');
    req.flush(blob);
    expect(received).toBe(blob);
  });
});
