import { TestBed } from '@angular/core/testing';

import { VideoUploadService } from './video-upload.service';
import { MediaService } from './media.service';
import { PushIdFactory } from './push-id.service';
import { Video } from '../models/media/video';

describe('VideoUploadService', () => {
  let service: VideoUploadService;
  let mediaServiceSpy: jasmine.SpyObj<MediaService>;
  let pushIdSpy: jasmine.SpyObj<PushIdFactory>;

  beforeEach(() => {
    mediaServiceSpy = jasmine.createSpyObj('MediaService', ['create']);
    pushIdSpy = jasmine.createSpyObj('PushIdFactory', ['create']);
    pushIdSpy.create.and.returnValue('video-id-1');

    TestBed.configureTestingModule({
      providers: [
        VideoUploadService,
        { provide: MediaService, useValue: mediaServiceSpy },
        { provide: PushIdFactory, useValue: pushIdSpy },
      ]
    });

    service = TestBed.inject(VideoUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('upload assigns an id, builds hosted URLs and saves the video', () => {
    const video = new Video('', 'Reunion', '', '', 'my video.mp4', '2024-01-01');

    service.upload(video);

    expect(video.id).toBe('video-id-1');
    expect(video.urls.download).toBe('https://assets.lecoursville.com/Video/my%20video.mp4');
    expect(video.urls.icon).toBe('https://assets.lecoursville.com/Video/Icons/my%20video.jpg');
    expect(video.dateUpdated).toBeInstanceOf(Date);
    expect(mediaServiceSpy.create).toHaveBeenCalledWith(video);
  });

  it('upload keeps an existing id', () => {
    const video = new Video('existing-id', 'Reunion', '', '', 'clip.mp4', '2024-01-01');

    service.upload(video);

    expect(video.id).toBe('existing-id');
    expect(pushIdSpy.create).not.toHaveBeenCalled();
    expect(video.urls.download).toBe('https://assets.lecoursville.com/Video/clip.mp4');
    expect(mediaServiceSpy.create).toHaveBeenCalledWith(video);
  });
});
