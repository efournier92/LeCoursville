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
- [To Do Features](#to-do-features)

## Overview
I hail from a very large family on my mother's side: the LeCours family. She had 13 siblings, which amounted to 42 cousins in my generations, and many more in subsquent generations. Since I was young, my Mom & I would annually print a family calendar containing birthdays and anniversaries, along with a booklet containing contact info for each family member. These distributions were always, and continue to be, a test of my technical prowess. Hence, in 2018, I thought it was time to migrate that data to the web, so we could keep it constantly updated. I build this website for that purpose.

## Demo
[LeCoursville.com](https://www.lecoursville.com)

## Features

### Calendar
- View birthdays and anniversaries by date via the GUI
- Print calendars by year
![Calendar Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Calendar.png?raw=true)

### Contacts
- View contact info 
- Search contact info by string
- Sort contact info by family
![Contacts Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Contacts.png?raw=true)

### Chat
- Post messages to a common board
![Chat Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Chat.png?raw=true)

### Photos
- View and upload family photos
![Chat Screenshot](https://github.com/efournier92/lecoursville/blob/master/src/assets/img/screenshots/Screenshot_Photos.png?raw=true)

## Development Philosophy
Since the tools hosted here are meant for users of all ages, keeping them simple to use was my goal first and foremost. 

### Stack
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
- Populate with the following object with your Firebase account details

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

### Contributing
I'm not currently accepting pull requests for this project. Please feel free to fork this repo for your own purposes!

### Licensing
This project is provided under the `MIT` licence and I hereby grant rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software without limitation, provided the resulting software also carries the same open-source licensing statement.

## To Do Features
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

