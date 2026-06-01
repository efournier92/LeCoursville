# LeCoursville

## Overview

This is a **Firebase-only application** — no backend server. All data storage, authentication, and serving run through Firebase services.

## Architecture

- **Frontend**: Angular (hosted on Firebase Hosting)
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Auth (Email/Password + FirebaseUI)
- **File Storage**: Firebase Storage
- **Analytics**: Firebase Analytics
- **Hosting**: Firebase Hosting

## Key Firebase Services Used

| Service | Firebase Product | Usage |
|---|---|---|
| Auth | FirebaseUI + AngularFireAuth | Email/password sign-in, password reset |
| Database | AngularFireDatabase (RTDB) | All persistent data — users, photos, calendar events, contacts, media, uploads |
| Storage | AngularFireStorage | User-uploaded files (photos, videos, audio) |
| Analytics | AngularFireAnalytics | User行为 tracking |

## Authentication

- Uses `firebaseui-angular` for the sign-in widget
- Auth config at `src/app/auth.config.ts`
- Firebase Auth handles password reset emails — requires DKIM, SPF, DMARC DNS records for proper deliverability

## Project Structure

```
src/
  app/
    models/         # Data models (User, Photo, UserUpload, PhotoAlbum, etc.)
    services/       # Angular services for Firebase interactions
    components/     # Angular components
    interfaces/     # TypeScript interfaces
    constants/      # App constants
    styles/         # Shared SCSS
  environments/     # Firebase config per environment
```

## Important Constraints

- **No backend server** — all API calls go directly to Firebase
- **No server-side logic** — any business logic runs in the browser or Firebase Rules
- **Security Rules** are defined in Firebase Console and govern RTDB and Storage access
- **Email delivery** for password reset is handled by Firebase — requires DNS configuration for deliverability

## Firebase Resources

- Project Console: https://console.firebase.google.com/project/lecoursville-dev
- Auth: Email/password provider, FirebaseUI widget
- Database: Realtime Database (not Firestore)
- Storage: Default Firebase Storage bucket

## Design Specifications

Design specs live in `design_specs/` and document architecture, rationale, and implementation details for complex features. When working on a feature with an existing spec, read it first.

## Developing Locally

- `ng serve` to run the Angular dev server
- Firebase config in `src/environments/environment.ts` (dev project)
- Auth domain: `lecoursville-dev.firebaseapp.com`
- Production domain: `lecoursville.com`