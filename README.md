# ![LeCoursville](https://raw.githubusercontent.com/efournier92/LeCoursville/master/src/assets/img/logo/LeCoursville_Logo_Black.png)

## Contents
- [Overview](#overview)
- [Demo](#demo)
- [Development Philosophy](#development-philosophy)
- [Stack](#stack)
- [Configuration](#configuration)
- [Build](#building)
- [Test](#testing)
- [Contribute](#contributing)
- [Licence](#licensing)
- [Features](#features)
- [Features To Do](#features-to-do)

## Overview
Built as a platform for distributing information across large families, this application packs a handful of cool features. It was developed using [Angular](https://angular.io/) and employs [Firebase](https://firebase.google.com/) tools heavily. It features an address-book page, where users can view, add, and update contact information. It also features a calendar, for viewing and managing birthdays/anniversary data, along with a chat page to function as a message board. Both calendar and contact data can be printed, leveraging [jsPDF](https://github.com/MrRio/jsPDF/) on the code side. A photos component displays user-uploaded images. Three tiers of user privileges, along with a confirmation-prompt module, ensure data isn't altered accidentally. Users with `super` privileges can visit the admin page to edit user information, or to delete a user. This app is a work in progress, and new features are still being added.

## Demo
[LeCoursville.com](https://www.lecoursville.com)

## Development Philosophy
I come from a very large family on my mother's side: the LeCours family. She had 13 siblings, who bought 42 first-cousins, who are now joined by dozens more from the next generations. Since I was young, my Mom and I would annually print a family calendar containing birthdays and anniversaries, along with a booklet containing contact info for each family member. These distributions were always, and continue to be, a test of my technical prowess. Hence, in 2018, I thought it was time to migrate that data to the web, so we could keep it updated in real time. Since these tools are meant for users of all ages, keeping them simple and easy-to-use was my primary goal. In an effort to keep the site styled consistently, I built it using [Angular Material](https://github.com/angular/material2) from the start. I designed it using a mobile-first approach, so all pages render nicely of devices of any size. I'd been wanting to experiment with using Firebase tools in lieu of a back-end, which I accomplished here using their [Auth](https://firebase.google.com/products/auth/), [Hosting](https://firebase.google.com/products/hosting/), and [Realtime Database](https://firebase.google.com/products/realtime-database/) modules. The result is a clean and simple interface, with production-grade security of the DB side. This site was, and continues to be, a joy to build and maintain.

## Stack
- [Angular](https://angular.io/)
- [Angular Material](https://material.angular.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [Firebase Realtime Database](https://firebase.google.com/products/realtime-database/)
- [Firebase Hosting](https://firebase.google.com/products/hosting/)
- [Firebase Authentication](https://firebase.google.com/products/auth/)
- [SCSS](https://sass-lang.com)
- [Bootstrap](https://getbootstrap.com/)
- [RxJS](http://reactivex.io/)
- [jsPDF](https://github.com/MrRio/jsPDF/)

## Configuration

### /src/environments/secrets.ts
1. Create `secrets.ts` in `/src/environments/`
2. Copy the following object into `secrets.ts`
3. Populate values with details from your Firebase account

```typescript
export const secrets = {
  firebaseConfig: {
    apiKey: "API_KEY",
    authDomain: "AUTH_DOMAIN",
    databaseURL: "DATABASE_URL",
    projectId: "PROJECT_ID",
    storageBucket: "STORAGE_BUCKET",
    messagingSenderId: "MESSAGE_SENDER_ID",
  },
};
```

## Build

### Local
`ng serve`

### Production
`ng build --prod`

## Test
`ng test`

## Contribute
If you have feature suggestions, please contact me here or at efournier92@gmail.com. If you'd like to submit a pull request, please feel free and I'll merge it at my earliest convenience!

## License
This project is provided under the [`MIT`](https://opensource.org/licenses/MIT) licence and I hereby grant rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software without limitation, provided the resulting software also carries the same open-source licensing statement.

## Features

### Calendar
- View birthdays and anniversaries by date via calendar GUI
- Print calendars for any year
- Add new calendar events [_Admin Only_]
![Calendar Screenshot](https://raw.githubusercontent.com/efournier92/LeCoursville/master/src/assets/img/screenshots/Screenshot_Calendar.png)

### Contacts
- View contact info 
- Search contact info by string
- Sort contact info by family
- Add or edit contacts [_Admin Only_]
![Contacts Screenshot](https://raw.githubusercontent.com/efournier92/LeCoursville/master/src/assets/img/screenshots/Screenshot_Contacts.png)

### Chat
- Post messages to a common board
- Attach documents of any type
- Reply to a message
- Like a message
- Edit existing message [_Original Poster or Admin Only_]
![Chat Screenshot](https://raw.githubusercontent.com/efournier92/LeCoursville/master/src/assets/img/screenshots/Screenshot_Chat.png) 

### Photos
- View and upload family photos
![Chat Screenshot](https://raw.githubusercontent.com/efournier92/LeCoursville/master/src/assets/img/screenshots/Screenshot_Photos.png) 

## Features To Do
* [ ] Edit name
* [ ] Edit event mobile styling (dialog width)
* [ ] Contact edit button styling
* [ ] Blank message validation
* [ ] New contact edit mode
* [ ] Bulk photo delete
* [ ] Photo comments
* [ ] Upload component 
  - [ ] Chat message becomes first comment
* [ ] Fix message nested reply pattern
* [ ] `lightgallery` component
  - [ ] Photos
  - [ ] Chat
* [ ] Cancel button for `Sort By Family`
* [~] Add stories component
* [X] File input component
* [X] PDF print-from-html
* [X] IE Chat Bug
* [X] Confirm prompt instances
  - [X] Upload photos
  - [X] Delete photo
  - [X] Post message
  - [X] Delete message
  - [X] Restore message
  - [X] Sign out
  - [X] Add contact
  - [X] Create event
  - [X] Delete event
* [ ] Photo lightbox labels
* [X] Name above `sign out` button
* [ ] Label Photos
* [ ] Integrate GA
* [X] `zlib` warning
* [X] Chat photo in message
* [X] Admin tools (super user)
* [X] Photos upload progress bar
* [X] Photos click lightbox with zoom
* [X] Photos Sortability
* [X] PhotoBy
* [X] DB Rules
* [X] IE Compatibility
* [X] Calendar Cell Dialog always show title
* [X] Fix Birthdays
* [X] Caching
* [X] Extend years in photos-edit component
* [X] Add `circa` feature to photos-edit component
* [X] Opt-in flow, email only
  - [X] Collect name at time of opt-in
* [X] Restore deleted message
* [X] Deceased functionality
* [X] Calendar event editability (Admin)
* [X] Upload calendar data to FireBase RTD
* [X] Endless scroll deletes message
* [X] Chat delete if no replies
* [X] Label chat icons
* [X] Message sticky
* [X] Only Email option (test across browsers & devices)
* [X] Multiple calendar years should be available[Print PDFs from FTM when home]
* [X] Calendar should be uploadable
* [X] Contacts print should open in hidden iframe
* [X] Edit contact Labels
* [X] Add isSaved to message
* [X] Fix name prompt (chat.component)
* [X] Fix chat naming conventions
* [X] Admin can edit any message
* [X] Chat message cancel deletes existing message
* [X] Chat should be sorted newest first
* [X] All typescript declarations

