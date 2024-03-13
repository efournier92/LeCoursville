# ![LeCoursville](https://raw.githubusercontent.com/efournier92/LeCoursville/master/src/assets/img/logo/LeCoursville_Logo_Green.png)

## Contents

- [Overview](#overview)
- [Demo](#demo)
- [Development Philosophy](#development-philosophy)
- [Stack](#stack)
- [Configuration](#configuration)
- [Build](#build)
- [Deploy](#deploy)
- [Test](#test)
- [Contribute](#contribute)
- [Licence](#license)
- [Major Version History](#major-version-history)
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
    apiKey: 'API_KEY',
    authDomain: 'AUTH_DOMAIN',
    databaseURL: 'DATABASE_URL',
    projectId: 'PROJECT_ID',
    storageBucket: 'STORAGE_BUCKET',
    messagingSenderId: 'MESSAGE_SENDER_ID',
  },
};
```

## Build

### Local

- `ng serve`

### Production

- `ng build --configuration=production`

## Test

`ng test`

## Deploy

### Select an Environment

- `firebase use --add`
  - Select:
    - `lecoursville` for Production
    - `lecoursville-dev` for Test

##### Deploy to the Selected Environment

- `firebase deploy`

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

# Lecoursville

## Commands

### Run the Development Server

- Run `ng serve` for a dev server.
  - Navigate to `http://localhost:4200/`.
  - The app will automatically reload if you change any of the source files.

### Run Unit Tests

- Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Run End-to-End Tests

- Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

### Deploy a Build

#### Build for Production

- `ng build --configuration=production`
  - The build artifacts will be stored in the `dist/` directory.

#### Deploy via Firebase

##### Select Environment

- `firebase use --add`
  - Select:
    - `lecoursville` for Production
    - `lecoursville-dev` for Test

##### Deploy to the Selected Environment

- `firebase deploy`

## Major Version History

### `24.3.14`

- Resolve add-calendar-event bug.
  - Add default values to `RecurringEvent` constructor
  - Add card to `displayedEvents` on add form AdminCalendarComponent.
- Add confirmation dialog on delete of calendar event.
- Adjust `mat-card` margins across the project.
- Adjust card styling in `AdminCalendarComponent`.
- Enhance styling across `AdminMedia` components
- Add dialog to better explain `getShareableLink` functionality.
- Standardize Admin button styling between `UserEdit` and `CalendarEdit` components.

### `24.3.3`

- Upgrade to `Angular 17`.
- Add `ExpressionsComponent` with associated functionality.
- Abstract `MessageComponent` from `ChatComponent` for inheritance from `ExpressionsComponent`.
- Resolve no-inputs bug after 1st auth flow.
- Add `noindex` tag to block search crawlers.
- Add `Not Living` toggle to calendar.
- Improve `SortSettings` implementation and consume from `AdminCalendarComponent`, `AdminUsersComponent` and `ExpressionsComponent`.

### `22.5.25`

- Upgrade to `Angular 12`.
- Restructure project to put all components at the same level.
- Add bulk-upload tooling to `Admin`.
- Add GA analytics logging functionality.
- Restyle main element of `CalendarComponent` for enhanced printability.
- Create generic `Media` models and components.
- Add `AudioComponent` with associated functionality.
- Add `VideoComponent` with associated functionality.

### `19.3.10`

- Add `Admin` functionality.
- Add download functionality for `PhotosComponent`.
- Resolve bugs discovered during testing.
- Refactor components from initial build.

### `18.12.22`

- Initial build.
- Establish app styling.
- Build `Auth` flow.
- Add `ContactsComponent` with associated functionality.
- Add `PhotosComponent` with associated functionality.
- Add `ChatComponent` with associated functionality.
- Add `CalendarComponent` with associated functionality.

## Features TODO

- [ ] Edit name
- [ ] Edit event mobile styling (dialog width)
- [ ] Contact edit button styling
- [ ] Blank message validation
- [ ] New contact edit mode
- [ ] Bulk photo delete
- [ ] Photo comments
- [ ] Upload component
  - [ ] Chat message becomes first comment
- [ ] Fix message nested reply pattern
- [ ] `lightgallery` component
  - [ ] Photos
  - [ ] Chat
- [ ] Cancel button for `Sort By Family`
- [x] File input component
- [x] PDF print-from-html
- [x] IE Chat Bug
- [x] Confirm prompt instances
  - [x] Upload photos
  - [x] Delete photo
  - [x] Post message
  - [x] Delete message
  - [x] Restore message
  - [x] Sign out
  - [x] Add contact
  - [x] Create event
  - [x] Delete event
- [ ] Photo lightbox labels
- [x] Name above `sign out` button
- [-] Label Photos
- [ ] Integrate GA
- [x] `zlib` warning
- [x] Chat photo in message
- [x] Admin tools (super user)
- [x] Photos upload progress bar
- [x] Photos click lightbox with zoom
- [x] Photos Sortability
- [x] PhotoBy
- [x] DB Rules
- [x] IE Compatibility
- [x] Calendar Cell Dialog always show title
- [x] Fix Birthdays
- [x] Caching
- [x] Extend years in photos-edit component
- [x] Add `circa` feature to photos-edit component
- [x] Opt-in flow, email only
  - [x] Collect name at time of opt-in
- [x] Restore deleted message
- [x] Deceased functionality
- [x] Calendar event editability (Admin)
- [x] Upload calendar data to FireBase RTD
- [x] Endless scroll deletes message
- [x] Chat delete if no replies
- [x] Label chat icons
- [x] Message sticky
- [x] Only Email option (test across browsers & devices)
- [x] Multiple calendar years should be available[Print PDFs from FTM when home]
- [x] Calendar should be uploadable
- [x] Contacts print should open in hidden iframe
- [x] Edit contact Labels
- [x] Add isSaved to message
- [x] Fix name prompt (chat.component)
- [x] Fix chat naming conventions
- [x] Admin can edit any message
- [x] Chat message cancel deletes existing message
- [x] Chat should be sorted newest first
- [x] All typescript declarations
