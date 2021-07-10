import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Video } from 'src/app/models/media';
import { VideoUploadDialogComponent as CreateVideoDialogComponent } from './video-upload-dialog/video-upload-dialog.component';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { VideosService } from 'src/app/services/videos.service';
import { SampleMediaService } from 'src/app/constants/sample-media';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-videos',
  templateUrl: './videos.component.html',
  styleUrls: ['./videos.component.scss']
})
export class VideosComponent implements OnInit {
  videogular: any;
  allVideos: Video[];
  filteredVideos: Video[];
  selectedVideos: Video[];
  selectedVideo: Video;
  user: User;

  constructor(
    private auth: AuthService,
    private videosService: VideosService,
    public dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user) {
          this.user = user;
          console.log("VIDEO USER: ", this.user);
        }
      }
    )

    // this.videosService.videosObservable.subscribe(
    //   (videos: Video[]) => {
    //     this.allVideos = videos;
    //     if (!this.filteredVideos || !this.filteredVideos.length)
    //       this.filteredVideos = this.allVideos;
    //   }
    // )

    this.allVideos = [];
    
    const sampleMediaService = new SampleMediaService();
    const videos = sampleMediaService.get();

    videos.forEach(video => {
      if (video instanceof Video) {
        video = this.updateGoogleDriveUrlFormat(video);
        this.allVideos.push(video);
      }
    });

    console.log("Videos -> ", this.allVideos);

    this.filteredVideos = this.allVideos;
  }

  updateGoogleDriveUrlFormat(video: Video){
    if (video.url.includes("https://drive.google.com/file/d/")) {
      let id = video.url.replace("https://drive.google.com/file/d/", "").replace("/view?usp=sharing", "")
      let newUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${environment.googleApiKey}`
      video.url = newUrl;
    }

    if (video.icon.includes("https://drive.google.com/file/d/")) {
      let id = video.icon.replace("https://drive.google.com/file/d/", "").replace("/view?usp=sharing", "")
      let newUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${environment.googleApiKey}`
      video.icon = newUrl;
    }

    return video;
  }

  initVideoPlayer(data: any) {
    this.videogular = data;
  }

  onVideoSelect(video: Video): void {
    if (video && video.url && video.format)
      this.setCurrentVideo(video);
  }

  setCurrentVideo(video: Video) {
    this.videogular.pause();

    this.selectedVideo = video;
    this.selectedVideos = new Array<Video>();
    this.selectedVideos.push(video);

    this.videogular.getDefaultMedia().currentTime = 0;

    this.videogular.play();
  }

  filterResults(searchTerm: string) {
    this.filteredVideos = this.allVideos.filter(
      video => {
        var name = video.name.toLowerCase();
        var location = video.location.toLowerCase();
        var term = searchTerm.toLowerCase();
        return name.includes(term) || location.includes(term);
      })
  }

  shouldDisplayVideoPlayer() {
    return this.selectedVideo && this.selectedVideo.url && this.selectedVideo.format
      ? ''
      : 'none';
  }

  openCreateVideoDialog() {
    const dialogRef = this.dialog.open(CreateVideoDialogComponent);

    dialogRef.afterClosed().subscribe((video: Video) => {
      if (video && video.name && video.url && video.icon && video.location && video.duration)
        this.createVideo(video);
    });
  }

  createVideo(video: Video) {
    this.videosService.create(video);
  }

}
