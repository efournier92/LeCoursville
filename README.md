# ![LeCoursville](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/logo/LeCoursville_Logo_Black.png?raw=true)

## Table of Contents
- [Overview](#overview)
- [Demo](#demo)
- [Features](#features)
- [Development Philosophy](#development-philosophy)
- [Stack](#stack)
- [Configuration](#configuration)
- [Building](#building)
- [Testing](#testing)
- [Contributing](#contributing)
- [Licensing](#licensing)
- [Features To Do](#to-do-features)

## Overview
I come from a very large family on my mother's side: the LeCours family. She had 13 siblings, which saw 42 cousins born to my generations, then many more who sprung from there. Since I was young, my Mom & I would annually print a family calendar containing birthdays and anniversaries, along with a booklet containing contact info for each family member. These distributions were always, and continue to be, a test of my technical prowess. Hence, in 2018, I thought it was time to migrate that data to the web, so we could keep it constantly updated. I build this website for that purpose, then added another component to upload and display photos pertainent to our family's history. Finally, I added a chat component to help us keep in touch. Building this website was a labor of love, and I look forwared to working on further enhancements in the future.

## Demo
[LeCoursville.com](https://www.lecoursville.com)

## Features

### Calendar
- View birthdays and anniversaries by date via calendar GUI
- Print calendars for any year
- Add new calendar events [_Admin Only_]
![Calendar Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Calendar.png?raw=true)

### Contacts
- View contact info 
- Search contact info by string
- Sort contact info by family
- Add or edit contacts [_Admin Only_]
![Contacts Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Contacts.png?raw=true)

### Chat
- Post messages to a common board
- Attach documents of any type
- Reply to a message
- Like a message
- Edit existing message [_Original Poster or Admin Only_]
![Chat Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Chat.png?raw=true)

### Photos
- View and upload family photos
![Chat Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Photos.png?raw=true)

## Development Philosophy
Since these tools are meant for users of all ages, keeping them simple and easy-to-use was my goal first and foremost. In an effort to keep the site constently styled, I built it using [Angular Material](https://github.com/angular/material2) from the start. I also wanted to experiment wiht using Firebase tools in lieu of a back-end, which I accomplished with their Authentication, Hosting, and Realtime Database modules. The result is a clean and simple interface, with production-grade security of the DB side.

## Stack
- Angular
- TypeScript
- Firebase Realtime Database
- Firebase Hosting
- Firebase Authentication
- SCSS
- Angular Material
- Bootstrap
- RxJS
- jsPDF

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

## Building

### Local
`ng serve`

### Production
`ng build --prod`

## Testing
`ng test`

## Contributing
If you have feature suggestions, please contact me here or at efournier92@gmail.com. If you'd like to submit a pull request, please feel free and I'll merge it at my earliest convenience!

## Licensing
This project is provided under the `MIT` licence and I hereby grant rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software without limitation, provided the resulting software also carries the same open-source licensing statement.

## Features ToDo
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
