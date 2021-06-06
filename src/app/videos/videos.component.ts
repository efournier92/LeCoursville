import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';

class Video {
  name: string;
  date: string;
  icon: string;
  id: string;
  type: string;

  constructor(name, date, icon, id) {
    this.name = name;
    this.date = date;
    this.icon = icon;
    this.id = id;
    this.type = "video/mp4";
  }
}

@Component({
  selector: 'app-videos',
  templateUrl: './videos.component.html',
  styleUrls: ['./videos.component.scss']
})
export class VideosComponent implements OnInit {
  videoId: string;
  key: string;
  videos: Video[];
  myControl = new FormControl();
  videogular: any;
  sources: Object[];

  constructor() { }

  ngOnInit(): void {
    this.videoId = "12Auc2AVANwEKVidXsyRy1K2WYWOpq49M";
    this.key = "AIzaSyB0O5xzuR9PvyU_5YHq8byjOcMk1adqbVg";

    this.videos = [];
    this.videos.push(
      new Video(
        "Mr Smith Goes to Washington",
        "1939-02-02",
        "https://psmag.com/.image/t_share/MTM3MzY4OTM2MTA5ODQzNjI1/mrsmithjpg.jpg",
        "1NNVBUVTKQDi_VOTHEWpUpTC7TgqURmsG",
      ),
      new Video(
        "Wizard of Oz",
        "1939-03-03",
        "https://imgix.bustle.com/flavorwire/2013/08/wizard-of-oz-1.jpg?w=1080&h=608&fit=crop&crop=faces&auto=format%2Ccompress",
        "11yc1OURPIzWd5Aglm6eoZPoQ2-4bnMX7",
      ),
      new Video(
        "12 Angry Men",
        "1939-04-04",
        "https://images-na.ssl-images-amazon.com/images/G/01/digital/video/hero/Movies/Top250/B001MLWLHG_12angrymen_UXFX1._RI_.jpg",
        "14pvSvz_K5GEeQ-NKfbeFrOLy7i57KsbX",
      ),
      new Video(
        "Mr Smith Goes to Washington",
        "1939-02-02",
        "https://psmag.com/.image/t_share/MTM3MzY4OTM2MTA5ODQzNjI1/mrsmithjpg.jpg",
        "1NNVBUVTKQDi_VOTHEWpUpTC7TgqURmsG",
      ),
      new Video(
        "Wizard of Oz",
        "1939-03-03",
        "https://imgix.bustle.com/flavorwire/2013/08/wizard-of-oz-1.jpg?w=1080&h=608&fit=crop&crop=faces&auto=format%2Ccompress",
        "11yc1OURPIzWd5Aglm6eoZPoQ2-4bnMX7",
      ),
      new Video(
        "12 Angry Men",
        "1939-04-04",
        "https://images-na.ssl-images-amazon.com/images/G/01/digital/video/hero/Movies/Top250/B001MLWLHG_12angrymen_UXFX1._RI_.jpg",
        "14pvSvz_K5GEeQ-NKfbeFrOLy7i57KsbX",
      ),
      new Video(
        "Mr Smith Goes to Washington",
        "1939-02-02",
        "https://psmag.com/.image/t_share/MTM3MzY4OTM2MTA5ODQzNjI1/mrsmithjpg.jpg",
        "1NNVBUVTKQDi_VOTHEWpUpTC7TgqURmsG",
      ),
      new Video(
        "Wizard of Oz",
        "1939-03-03",
        "https://imgix.bustle.com/flavorwire/2013/08/wizard-of-oz-1.jpg?w=1080&h=608&fit=crop&crop=faces&auto=format%2Ccompress",
        "11yc1OURPIzWd5Aglm6eoZPoQ2-4bnMX7",
      ),
      new Video(
        "12 Angry Men",
        "1939-04-04",
        "https://images-na.ssl-images-amazon.com/images/G/01/digital/video/hero/Movies/Top250/B001MLWLHG_12angrymen_UXFX1._RI_.jpg",
        "14pvSvz_K5GEeQ-NKfbeFrOLy7i57KsbX",
      ),
      new Video(
        "Mr Smith Goes to Washington",
        "1939-02-02",
        "https://psmag.com/.image/t_share/MTM3MzY4OTM2MTA5ODQzNjI1/mrsmithjpg.jpg",
        "1NNVBUVTKQDi_VOTHEWpUpTC7TgqURmsG",
      ),
      new Video(
        "Wizard of Oz",
        "1939-03-03",
        "https://imgix.bustle.com/flavorwire/2013/08/wizard-of-oz-1.jpg?w=1080&h=608&fit=crop&crop=faces&auto=format%2Ccompress",
        "11yc1OURPIzWd5Aglm6eoZPoQ2-4bnMX7",
      ),
      new Video(
        "12 Angry Men",
        "1939-04-04",
        "https://images-na.ssl-images-amazon.com/images/G/01/digital/video/hero/Movies/Top250/B001MLWLHG_12angrymen_UXFX1._RI_.jpg",
        "14pvSvz_K5GEeQ-NKfbeFrOLy7i57KsbX",
      ),
    );

  }

  videoPlayerInit(data: any) {
    this.videogular = data;
    this.onVideoSelect(this.videos[1]);


    // this.data.getDefaultMedia().subscriptions.loadedMetadata.subscribe(this.initVdo.bind(this));
    // this.data.getDefaultMedia().subscriptions.ended.subscribe(this.nextVideo.bind(this));
  }

  getVideoUrl(id: string, key: string): string {
    var output = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${key}`;
    return output;
  }

  onVideoSelect(video: Video): void {
    console.log(video.name);
    this.videoId = video.id;

    var url = this.getVideoUrl(video.id, this.key);

    this.setCurrentVideo(url, video.type);
  }

  setCurrentVideo(source : string, type : string) {
    this.videogular.pause();

    this.sources = new Array<Object>();
    this.sources.push({
      src: source,
      type: type
    });

    this.videogular.getDefaultMedia().currentTime = 0;

    this.videogular.play();
  }

}
