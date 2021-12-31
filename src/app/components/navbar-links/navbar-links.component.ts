import { Component, Input, OnInit } from '@angular/core';

export interface LinkableButton {
    title: string;
    link: string;
    icon: string;
}

@Component({
  selector: 'app-navbar-links',
  templateUrl: './navbar-links.component.html',
  styleUrls: ['./navbar-links.component.scss']
})
export class NavbarLinksComponent implements OnInit {
  @Input() isMenuList: boolean;

  buttons: LinkableButton[] = [
    {
      title: 'Music',
      link: '/media/audio',
      icon: 'library_music',
    },
    {
      title: 'Videos',
      link: '/media/video',
      icon: 'local_movies',
    },
    {
      title: 'Calendar',
      link: '/calendar',
      icon: 'calendar_today',
    },
    {
      title: 'Contacts',
      link: '/contacts',
      icon: 'people',
    },
    {
      title: 'Photos',
      link: '/photos',
      icon: 'photo',
    },
    {
      title: 'Chat',
      link: '/chat',
      icon: 'message',
    },
    {
      title: 'Account',
      link: '/',
      icon: 'account_circle',
    },
  ];

  constructor() { }

  ngOnInit(): void {
  }

}
