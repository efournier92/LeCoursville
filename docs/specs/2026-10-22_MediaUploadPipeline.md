# Media Upload Pipeline

Branch context: `feat/admin-facelift`, based on `master` at `07cf5bf3`. This spec covers the admin media upload surfaces and the Cloud Functions media API. It does not implement anything.

## Context And Motivation

The admin video flow today moves no bytes. The admin uploads the MP4 to an S3 bucket by hand, uploads a thumbnail named `<basename>.jpg` to a fixed Icons prefix, then types the filename into the admin form. The app turns that filename into two URLs by string replacement (`src/app/services/video-upload.service.ts:28-42`). A typo, a space, a renamed file, or a missing thumbnail produces a record that silently fails to play or shows a broken icon.

The audio album flow has the same shape with more manual steps. The admin uploads every track to a folder name they invent, uploads a cover as `Covers/<folder>.jpg`, builds and uploads `Zips/<folder>.zip`, then types the folder name and a newline-separated track list into the form (`src/app/services/audio-album-upload.service.ts:18-111`). Track titles come from those typed lines, ordering comes from line order, and the cover and zip are never checked for existence.

Both flows are error-prone because the browser knows nothing about the bucket. The fix is to let the browser put the bytes into the existing bucket through short-lived presigned URLs minted by an admin-only Cloud Function, then have a second Function verify the objects and write the database record. The S3 layout and CloudFront distribution stay exactly as they are. No migration is required because stored URLs already point at CloudFront.

Audio albums reuse the same machinery. The differences are input derivation (folder, tracks, cover, zip) and record shape, not transport, verification, or lifecycle.

## Glossary

**Asset**

A single S3 object managed by an upload session. Examples: the video file, its thumbnail, an album track, the album cover, the album zip. _Avoid_: file, blob, object when the S3 meaning is not intended.

**Batch**

One upload session identified by `batchId`, created by the ticket callable and consumed once by the finalize callable. It binds the exact asset keys and sizes that were authorized. _Avoid_: session, job.

**Ticket**

A short-lived presigned S3 PUT URL plus the exact headers the browser must send. _Avoid_: token, signature.

**Managed Record**

A `media/{id}` record with a `storage` object stamped by the finalize callable. Only managed records get storage lifecycle handling. Legacy records have no `storage` field.

**Storage Name**

The editable, URL-safe video base name that determines `Video/<name>.mp4` and `Video/Icons/<name>.jpg`. _Avoid_: slug, filename when the displayed title is meant.

**Folder Name**

The editable audio album segment that determines `Music/Albums/<folder>/`, `Covers/<folder>.jpg`, and `Zips/<folder>.zip`. It follows the legacy plus-for-space convention. _Avoid_: album key, slug.

## Current State

### Video Upload

- The admin form has title, file name, date, id, sticky, and hidden fields, and no file input (`src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:7-54`).
- Validation requires only title, file name, and date (`src/app/components/admin-media-upload-video/admin-media-upload-video.component.ts:104-110`).
- Submit calls `VideoUploadService.upload` and clears the form on success (`src/app/components/admin-media-upload-video/admin-media-upload-video.component.ts:53-68`).
- `VideoUploadService.upload` assigns a push id, sets `dateUpdated`, derives both URLs, then writes the record (`src/app/services/video-upload.service.ts:16-26`).
- The icon URL is `https://assets.lecoursville.com/Video/Icons/<encodeURIComponent(basename)>.jpg` (`src/app/services/video-upload.service.ts:28-35`).
- The download URL is `https://assets.lecoursville.com/Video/<encodeURIComponent(fileName)>` (`src/app/services/video-upload.service.ts:37-42`).
- The base URL and folder names live in `HostingConstants` (`src/app/constants/hosting-constants.ts:11-15`).
- `assets.lecoursville.com` resolves through CloudFront to an S3 origin. Verified on 2026-10-22: `server: AmazonS3`, `x-cache: Error from cloudfront`, `via: ...cloudfront.net`.
- The explorer renders every video inside a Google Drive preview iframe (`src/app/components/media-explorer/media-explorer.component.html:45-54`, `src/app/components/video-player-drive-iframe/video-player-drive-iframe.component.ts:42-44`).
- The video model stores `id`, `title`, `date`, `fileName`, `urls.download`, `urls.icon`, `type`, `format`, `dateUpdated`, `duration`, `isSticky`, `isHidden`, `artist`, `folderName`, and `listing` (`src/app/models/media/video.ts:4-18`).
- Video type is `video` with format `video/mp4` (`src/app/constants/media-constants.ts:23-28`).
- Media records are written at `media/{id}` through `MediaService.create` (`src/app/services/media.service.ts:44-51`).
- Delete removes the record and any `listing` children, but never touches S3 (`src/app/services/media.service.ts:88-98`).
- The media node is public read with admin-only write (`database.rules.json:140-143`).
- A separate legacy `videos` node exists and is unused (`database.rules.json:136-139`).
- No Cloud Function touches media or storage. The export list contains auth, recovery, upload, alert, and role functions only (`functions/src/index.ts:5-15`).
- The only byte-upload implementation in the app writes Firebase Storage photos and returns a progress task plus a download URL (`src/app/services/photos.service.ts:144-178`). It is the right shape, but the wrong destination.

### Audio Album Upload

- The admin form has title, folder name, a newline-separated tracks textarea, sticky, and hidden fields (`src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.html:7-52`).
- The file change handler only logs to the console (`src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.ts:109-111`).
- Validation requires title and folder name only (`src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.ts:123-128`).
- Submit calls `AudioAlbumUploadService.upload` with the album, folder, and raw track string (`src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.ts:60-85`).
- The album cover URL is `<base>/Music/Albums/Covers/<folder>.jpg` after replacing spaces with plus signs (`src/app/services/audio-album-upload.service.ts:55-62`).
- The album zip URL is `<base>/Music/Albums/Zips/<folder>.zip` after replacing spaces with plus signs (`src/app/services/audio-album-upload.service.ts:64-71`).
- Track URLs are `<base>/Music/Albums/<folder>/<fileName>` after replacing spaces with plus signs (`src/app/services/audio-album-upload.service.ts:86-88`).
- Track titles strip only a trailing `.mp3` and keep the rest verbatim (`src/app/services/audio-album-upload.service.ts:105-111`).
- No code creates the album zip. The admin builds and uploads it by hand. The Download button appears only when `urls.download` contains `.zip` (`src/app/components/media-explorer/media-explorer.component.ts:167-171`).
- An album is only selectable when `urls.download` is non-empty, so an album without a zip is unplayable, not merely download-less (`src/app/components/media-explorer/media-explorer.component.ts:209-211`).
- `jszip` is already a dependency and is used for client-side zip creation in the admin uploads screen with a 500-item cap (`package.json:34`, `src/app/components/admin-user-uploads/admin-user-uploads.component.ts:507-536`).
- Every track inherits the album `urls.icon` (`src/app/services/audio-album-upload.service.ts:90-92`).
- Updating an existing album skips track creation and only rewrites the album (`src/app/services/audio-album-upload.service.ts:25-30`).
- Album listing is an array of track record ids, with no back-reference on the track (`src/app/models/media/audio-album.ts:4-17`, `src/app/models/media/audio-track.ts:4-17`).
- Deleting an album cascades to `listing` ids (`src/app/services/media.service.ts:88-98`).
- Audio album type is `audio-album` with format `collection/audio`; audio track is `audio-track` with format `audio/mpeg` (`src/app/constants/media-constants.ts:44-63`).
- The audio base URL is `https://assets.lecoursville.com` and the folder path is `Music/Albums` (`src/app/constants/hosting-constants.ts:2-10`).
- Video URL building uses `encodeURIComponent`, audio URL building uses literal plus signs for spaces. The two conventions differ (`src/app/services/video-upload.service.ts:32-41`, `src/app/services/audio-album-upload.service.ts:73-75`).

### Shared Surfaces

- The admin media page has two tabs, Video and Audio Album (`src/app/components/admin-media/admin-media.component.html:8-16`).
- The admin media route is `ADMIN_ROUTE.media` and renders `AdminMediaComponent` (`src/app/components/admin/admin.module.ts:29-34`).
- The media routes are public at the parent, with auth applied to list views (`src/app/app-routing.module.ts:81-83`).
- Both admin cards are gated on `admin` or `super` in the template (`src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:1`, `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.html:1`).
- The functions runtime is Node 20 with `firebase-admin` 13, `firebase-functions` 6, and `resend` (`functions/package.json:14-16`).
- Secrets are declared with `defineSecret`; the existing precedent is `RESEND_API_KEY` (`functions/src/config.ts:1-2`, `functions/src/config.ts:32`).
- Cloud Functions region is `us-central1` (`functions/src/config.ts:3`).
- The e2e gate builds the app, runs unit tests, builds functions, then runs Playwright against auth, database, storage, hosting, and functions emulators plus a seed (`scripts/e2e/gate.sh`).
- The seed writes hosting fixtures at runtime (`scripts/e2e/seed.mjs:352-359`).
- Seeded media includes one audio album, one track, one document, and one Drive-hosted video (`scripts/e2e/seed.mjs:269-296`).
- Existing media e2e tests pin the typed-filename form, inline validation, and the Drive iframe (`e2e/specs/media.spec.ts:14-155`).
- The e2e console collector fails on unexpected request failures; `net::` failures and Drive failures are allowlisted (`e2e/helpers/console.ts:24-31`).

## Goals

1. Let an admin drop an MP4 into the admin video tab and have the browser upload it to the existing S3 bucket through presigned URLs.
2. Generate the thumbnail in the browser from the video itself, with an adjustable frame and a manual override.
3. Derive the storage name, download URL, and thumbnail URL automatically, with editable names and a visible path preview.
4. Verify every uploaded object server-side before writing a media record, so no record can point at a missing or mismatched object.
5. Write managed records atomically and stamp server-derived upload metadata.
6. Invalidate the exact CloudFront paths after create, replace, and delete.
7. Give managed records real deletion, including S3 objects, while leaving legacy records on today's DB-only behavior.
8. Automate audio album uploads with a track drop, derived folder name, embedded cover art extraction with override, a browser-generated album zip, and editable ordering.
9. Reuse one transport, verification, finalize, and delete implementation for video and audio albums.
10. Keep the offline e2e gate green with a real upload path through an emulator-only sink.
11. Survive a dropped connection or a closed tab: resume an upload without re-sending completed assets.
12. Keep 2 GiB videos practical with presigned multipart above 100 MiB.
13. Bound every callable with rate limits, and bound the public record to fields a reader actually needs.

### Audio Album Reuse Analysis

The same pipeline fits audio albums. The shared pieces are the ticket callable, direct PUT with progress and cancel, the finalize callable with HEAD verification, server-side URL derivation, the managed-record stamp, CloudFront invalidation, the delete callable, the emulator sink, and the e2e harness. Those cover transport, trust, lifecycle, and testing.

The pieces that differ are input-specific:

| Capability | Video | Audio album |
|---|---|---|
| Asset count | 2: media plus thumbnail | 2 plus N: cover, zip, and one per track |
| Name source | Dropped filename slug | Album title derived folder, track filenames |
| Image source | Video frame capture plus override | Embedded ID3 art plus override |
| Extra input | None | Browser-generated zip, manual zip above 500 MB |
| Ordering | Not applicable | Track list order, editable |
| Record shape | One video record | One album record plus one record per track |
| Playback | Native video element for CloudFront | Unchanged native audio player |

Estimated reuse is most of the work. Only naming, cover extraction, track ordering, and the finalize record branch are video-specific or album-specific.

## User Stories

1. As an admin, I want to drop an MP4 into the video tab, so that I do not upload the file to S3 by hand.
2. As an admin, I want the storage name derived from the dropped file, so that I do not invent a name or a path.
3. As an admin, I want to edit the derived storage name, so that I can control the public URL.
4. As an admin, I want to see the final S3 key and thumbnail key before upload, so that I can catch a naming mistake before it ships.
5. As an admin, I want the title prefilled from the filename, so that repetitive typing disappears.
6. As an admin, I want the date defaulted to the current year, so that the common case needs no input.
7. As an admin, I want a thumbnail generated from a video frame, so that I do not create a separate file.
8. As an admin, I want to choose which frame becomes the thumbnail, so that the image is representative.
9. As an admin, I want to replace the generated thumbnail with my own image, so that a bad frame is not final.
10. As an admin, I want upload progress, so that I know a large file is actually moving.
11. As an admin, I want to cancel an upload, so that a mistaken file does not finish.
12. As an admin, I want a retry that does not re-upload bytes when only the record save failed, so that I do not waste a long upload.
13. As an admin, I want a clear duplicate-name message, so that I know whether to rename or delete.
14. As an admin, I want to edit video metadata without touching the file, so that corrections are cheap.
15. As an admin, I want to replace a video file under the same name, so that existing shared links keep working.
16. As an admin, I want deleting a managed video to remove its objects, so that storage does not leak.
17. As an admin, I want legacy videos to keep playing and to delete database-only, so that nothing old breaks.
18. As an admin, I want to drop multiple album tracks at once, so that I do not upload them one by one.
19. As an admin, I want the album folder derived from the title, so that I do not invent a folder name.
20. As an admin, I want track titles and order derived from filenames, so that I do not type a track list.
21. As an admin, I want to edit and reorder tracks before upload, so that the album plays in the intended order.
22. As an admin, I want embedded cover art extracted automatically, so that I do not create a cover file.
23. As an admin, I want to override the cover, so that albums without embedded art still work.
24. As an admin, I want the album zip generated in the browser from the tracks I already selected, so that I do not build it by hand.
25. As an admin, I want the album and its tracks saved in one operation, so that I never see a half-built album.
26. As an admin, I want a real delete for managed albums and tracks, so that storage stays clean.
27. As an admin, I want to delete and re-upload an album to change its content, so that the workflow is predictable.
28. As a family member, I want new videos to play natively with a poster image, so that playback does not depend on Drive.
29. As a family member, I want old shared links to keep playing, so that bookmarks and messages do not break.
30. As a family member, I want album playback and album download to behave exactly as before, so that the audio experience does not regress.
31. As a maintainer, I want every object verified before a record is written, so that broken records cannot be created.
32. As a maintainer, I want one pipeline for video and albums, so that a fix lands once.
33. As a maintainer, I want CloudFront paths invalidated on create, replace, and delete, so that changes are visible.
34. As a maintainer, I want an offline e2e path through an emulator sink, so that the deploy-blocking gate stays deterministic.
35. As a maintainer, I want least-privilege AWS credentials stored as secrets, so that the blast radius stays small.
36. As a super admin, I want the same media upload authority as an admin, so that role differences never block media work.
37. As an admin, I want a dropped upload to resume from the completed assets, so that a long video or album does not restart.
38. As an admin, I want to edit track titles and order without re-uploading the album, so that metadata fixes are cheap.
39. As a keyboard or screen-reader user, I want labeled controls, live progress, and predictable focus, so that I can complete an upload without a mouse.

## Non-Goals

- No migration or backfill of existing media records or bucket objects.
- No change to the S3 layout, bucket, CloudFront distribution, or public asset domain.
- No public or member uploads. Every new callable requires an admin or super role.
- No server-side transcoding. MP4 only for video, MP3 only for tracks.
- No adding or removing tracks on an existing album. Title and order edits are allowed through updateMediaMetadata; content changes mean delete and re-upload.
- No server-side zip generation and no on-the-fly zip at download time. The zip is built in the browser from the selected track files, with a manual fallback above 500 MB.
- No repair of malformed media.
- No change to the Firebase Storage rules. S3 is outside Firebase Storage.
- No new Angular dependency.
- No player redesign beyond choosing native video for non-Drive URLs.

## Prerequisites

These are hard blockers for production. The emulator path works without them.

### AWS IAM

Create one IAM user for the Functions runtime with this least-privilege policy, replacing the placeholders with the real bucket and distribution:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MediaObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": [
        "arn:aws:s3:::MEDIA_BUCKET/Video/*",
        "arn:aws:s3:::MEDIA_BUCKET/Music/Albums/*"
      ]
    },
    {
      "Sid": "MediaList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:ListBucketMultipartUploads"],
      "Resource": "arn:aws:s3:::MEDIA_BUCKET",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["Video/*", "Music/Albums/*"]
        }
      }
    },
    {
      "Sid": "Invalidate",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    }
  ]
}
```

`HeadObject` is authorized by `s3:GetObject`. `s3:ListBucket` is required for reliable not-found responses and duplicate checks. `If-Match` on replace requires `s3:GetObject` and `s3:PutObject` on the signing principal. Do not grant `s3:PutObjectAcl`; bucket owner enforced ownership is assumed.

Add a bucket lifecycle rule that aborts incomplete multipart uploads after one day. This bounds abandoned part storage without a custom sweeper. The lifecycle rule is a prerequisite, not application code.

### Bucket CORS

The browser PUTs directly to the S3 endpoint, not to CloudFront. The bucket must accept cross-origin PUT, HEAD, and GET from the app origins:

```json
[
  {
    "AllowedOrigins": [
      "https://lecoursville.com",
      "https://lecoursville.firebaseapp.com",
      "https://lecoursville-dev.web.app",
      "https://lecoursville-dev.firebaseapp.com"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type", "if-none-match", "if-match", "x-amz-meta-upload-batch", "x-amz-*"],
    "ExposeHeaders": ["ETag", "x-amz-version-id", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]
```

`x-amz-*` is needed because the presigned URL carries signature parameters in the query string; the header allowance covers SDK-added signed headers. `if-match` and `x-amz-meta-upload-batch` are signed application headers. Multipart part PUTs are ordinary PUTs, so POST is not needed in CORS: CreateMultipartUpload and CompleteMultipartUpload run in the Function, not the browser. If the bucket policy forbids wildcard headers, enumerate `x-amz-content-sha256`, `x-amz-date`, `x-amz-security-token`, `x-amz-user-agent`, and `x-amz-meta-upload-batch`.

### Secrets And Config

Set these as Firebase Functions secrets in both `lecoursville` and `lecoursville-dev` before any media callable deploys. This is Phase 0 work: binding an unset `defineSecret` parameter fails `firebase deploy`, so Phase 1 is not deployable until the secrets exist.

```bash
firebase functions:secrets:set MEDIA_AWS_REGION
firebase functions:secrets:set MEDIA_AWS_ACCESS_KEY_ID
firebase functions:secrets:set MEDIA_AWS_SECRET_ACCESS_KEY
firebase functions:secrets:set MEDIA_S3_BUCKET
firebase functions:secrets:set MEDIA_CLOUDFRONT_DISTRIBUTION_ID
```

Non-secret config with defaults lives in `functions/src/media/config.ts`:

- `MEDIA_BASE_URL`: `https://assets.lecoursville.com`. In the emulator it is derived as `http://localhost:5001/<project>/us-central1/emulatorMediaSink`.
- `MAX_VIDEO_BYTES`: `2147483648`.
- `MAX_TRACK_BYTES`: `209715200`.
- `MAX_IMAGE_BYTES`: `10485760`.
- `MAX_ZIP_BYTES`: `2147483648`.
- `MAX_TRACKS_PER_ALBUM`: `100`.
- `MAX_ALBUM_TRACK_BYTES`: `2000000000`. Reject at create when the sum of track sizes exceeds it, so the generated or manual zip stays under `MAX_ZIP_BYTES`.
- `TICKET_TTL_SECONDS`: `900`. Tickets are minted per asset immediately before use, so 15 minutes is enough and limits replay.
- `MULTIPART_THRESHOLD_BYTES`: `104857600`.
- `MULTIPART_PART_BYTES`: `8388608`.
- `MAX_PARTS`: `10000`.
- `SWEEP_GRACE_MS`: `86400000`.

The 500 MB browser zip cap is a client constant in `src/app/constants/media-upload-constants.ts` as `BROWSER_ZIP_MAX_BYTES`, not a functions config value. The server still enforces `MAX_ZIP_BYTES` at 2 GiB.

### Bucket Capability

Conditional create uses `If-None-Match: *` on PutObject. Confirm the bucket is a general purpose bucket, not a directory bucket. If conditional writes are unavailable, the code falls back to the HEAD check at ticket and finalize; the race window is then logged and documented, not silently ignored.

### Functions Dependencies

Add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, and `@aws-sdk/client-cloudfront` to `functions/package.json`. These run only in the functions runtime. The browser bundle gains no dependency.

### Hosting Origins

The two production origins are confirmed in `functions/src/config.ts:7-10`. The two dev origins match the Firebase project ids in `.firebaserc` but are not asserted anywhere in the repo. Confirm both dev hosts against the Firebase console during Phase 0. If a custom admin host is added later, it must be added to the bucket CORS list and the spec's prerequisite list.

## Design Principles

1. S3 and CloudFront remain the storage and delivery layer. No resource moves.
2. The server is the only authority for object keys and stored URLs. The client previews them; it cannot invent them.
3. Never write a record before the object exists and matches the ticket. Fail closed.
4. Use one batch ledger and one finalize path for both media kinds. Branch on kind only where the record shape differs.
5. Keep the legacy plus-for-space audio convention for new audio objects, so audio URLs, stored records, and the player stay uniform.
6. Keep existing records working untouched. Managed metadata is additive and optional.
7. Prefer atomic RTDB multi-path writes for album plus tracks.
8. Keep the e2e gate fully offline and real: drive the actual upload UI through an emulator sink, not a mock.
9. Keep the diff minimal: reuse the existing admin tabs, models, media list, audio player, and route structure.
10. Surface every failure with an actionable message and a retry that does not re-upload bytes when only finalize failed.
11. Bound every callable with the existing `rateLimit` helper, per uid and per batch.
12. Make large uploads resumable: lazy per-asset tickets, multipart above 100 MiB, and a resume path keyed on the batch.
13. Keep the public record free of uploader identity and write-only audit stamps. The server-only batch and deletion ledgers carry attribution.
14. Treat accessibility as a requirement, not a polish pass: labeled controls, live regions, keyboard order, and focus restoration.

## Backend Requirements

### Data Model

`UploadableMedia` stays as is; two optional fields are added to the concrete models and written only by the server.

Add to `src/app/models/media/media.ts` and the concrete types:

```ts
export interface MediaStorage {
  managed: true;
  key?: string;
  iconKey?: string;
  folder?: string;
  coverKey?: string;
  zipKey?: string;
  trackKeys?: string[];
  albumId?: string;
  bytes?: number;
  contentType?: string;
  batchId: string;
}

export interface UploadableMedia {
  // existing fields unchanged
  storage?: MediaStorage;
}
```

No uploader identity enters the public `media` node. The real uid lives only in `mediaUploads/{batchId}` and `mediaDeletions/{deletionId}`, both denied to clients. `storage.albumId` is stamped on managed tracks so a track delete can cascade to its parent album.

Video record written by finalize:

```ts
{
  id: string,
  title: string,
  artist: "",
  date: string,
  fileName: `${storageName}.mp4`,
  folderName: "",
  urls: {
    download: `${MEDIA_BASE_URL}/Video/${encodeURIComponent(storageName)}.mp4`,
    icon: `${MEDIA_BASE_URL}/Video/Icons/${encodeURIComponent(storageName)}.jpg`
  },
  type: "video",
  format: "video/mp4",
  dateUpdated: Date.now(),
  duration: string,
  isSticky: boolean,
  isHidden: boolean,
  listing: [],
  storage: {
    managed: true,
    key: `Video/${storageName}.mp4`,
    iconKey: `Video/Icons/${storageName}.jpg`,
    bytes: number,
    contentType: "video/mp4",
    batchId: string
  }
}
```

Album record written by finalize:

```ts
{
  id: string,
  title: string,
  artist: "",
  date: string,
  folderName: string,
  urls: {
    download: `${MEDIA_BASE_URL}/Music/Albums/Zips/${folder}.zip`,
    icon: `${MEDIA_BASE_URL}/Music/Albums/Covers/${folder}.jpg`
  },
  type: "audio-album",
  format: "collection/audio",
  dateUpdated: Date.now(),
  isSticky: boolean,
  isHidden: boolean,
  listing: string[],
  storage: {
    managed: true,
    folder: `Music/Albums/${folder}`,
    coverKey: `Music/Albums/Covers/${folder}.jpg`,
    zipKey: `Music/Albums/Zips/${folder}.zip`,
    trackKeys: string[],
    batchId: string
  }
}
```

Track record written by finalize:

```ts
{
  id: string,
  title: string,
  artist: "",
  date: string,
  urls: {
    download: `${MEDIA_BASE_URL}/Music/Albums/${folder}/${trackFileName}`,
    icon: albumIconUrl
  },
  type: "audio-track",
  format: "audio/mpeg",
  fileName: trackFileName,
  folderName: "",
  dateUpdated: Date.now(),
  isSticky: false,
  isHidden: false,
  listing: [],
  storage: {
    managed: true,
    key: `Music/Albums/${folder}/${trackFileName}`,
    albumId: string,
    bytes: number,
    contentType: "audio/mpeg",
    batchId: string
  }
}
```

All audio URLs pass through `encodeURI` after the plus substitution. `encodeURI` leaves `+` intact, encodes non-ASCII, and does not decode `+` to a space. This preserves the legacy plus-for-space convention. Unlike legacy records, new names reject `%`, `?`, `#`, and `&`, so the encoded URL always round-trips to the exact object key.

### Naming Rules

Implement these in `functions/src/media/naming.ts` as pure functions with unit tests. Mirror the preview-only subset in `src/app/services/media/media-naming.ts`; the server copy is authoritative and the client copy is only for previews.

Video storage name:

1. Take the filename without extension.
2. Unicode NFKD normalize and remove combining marks.
3. Lowercase.
4. Replace every run of characters outside `[a-z0-9]` with one dash.
5. Trim leading and trailing dashes.
6. Truncate to 80 characters.
7. If empty, use `video`.

Validation regex after editing: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 1 to 80. Example: `My Trip (2026).mp4` becomes `my-trip-2026`, key `Video/my-trip-2026.mp4`, icon key `Video/Icons/my-trip-2026.jpg`.

Audio folder name:

1. Trim.
2. Replace each run of spaces with one plus sign.
3. Reject `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, `#`, `%`, `&`, and control characters. Rejection is an inline validation error, not a silent strip, so the admin sees the exact problem.
4. Collapse repeated plus signs.
5. Trim leading and trailing plus signs.
6. Truncate to 100 characters.
7. If empty, use `album`.

Validation after editing: 1 to 100 characters, no path separators, no control characters, no leading or trailing plus. Example: `Le Cours 2026` becomes `Le+Cours+2026`.

Track filename:

1. Take the original filename.
2. Replace each run of spaces with one plus sign.
3. Remove path separators and control characters.
4. Require a `.mp3` suffix, case-insensitive, normalized to lowercase.
5. Preserve the rest verbatim.

Track title: original filename without the extension, with runs of `_` or `-` converted to single spaces and trimmed. Example: `01 - First_Dance.mp3` becomes `01 First Dance`. The admin can edit titles in the list before upload.

### Batch Ledger

New RTDB node `mediaUploads/{batchId}`:

```ts
{
  kind: "video" | "audio-album",
  mode: "create" | "replace",
  mediaId: string | null,
  uid: string,
  createdAt: number,
  lastActivityAt: number,
  status: "ticketed" | "finalizing" | "finalized",
  assets: Array<{
    role: "video" | "thumbnail" | "track" | "cover" | "zip",
    key: string,
    contentType: string,
    size: number,
    multipart: boolean,
    uploadId: string | null,
    parts: Array<{ partNumber: number, etag: string }>
  }>,
  resultId: string | null,
  finalizedAt: number | null
}
```

New RTDB node `mediaDeletions/{deletionId}`:

```ts
{
  deletionId: string,
  mediaIds: string[],
  keys: string[],
  uid: string,
  createdAt: number,
  status: "pending" | "completed",
  failedKeys: string[]
}
```

Rules: clients get no access to either node. Add `"mediaUploads": { ".read": false, ".write": false }` and `"mediaDeletions": { ".read": false, ".write": false }` to `database.rules.json`. The Admin SDK bypasses rules. Add `".indexOn": ["fileName", "folderName"]` to the `media` node so record-level duplicate checks do not scan the whole library. `media` read and write rules are unchanged.

### Callable: `createMediaUpload`

New file `functions/src/create-media-upload.ts`. Export from `functions/src/index.ts`. `onCall` with `region: REGION` and the five media secrets bound.

Request, initial call:

```ts
interface CreateMediaUploadRequest {
  kind: "video" | "audio-album";
  mode: "create" | "replace";
  mediaId?: string;
  video?: {
    storageName: string;
    sourceFileName: string;
    size: number;
    contentType: "video/mp4";
    thumbnail?: { sourceFileName: string; size: number; contentType: "image/jpeg" };
  };
  album?: {
    folderName: string;
    cover: { size: number; contentType: "image/jpeg" };
    zip: { size: number; contentType: "application/zip" };
    tracks: Array<{ sourceFileName: string; title: string; size: number; contentType: "audio/mpeg" }>;
  };
}
```

Response:

```ts
interface CreateMediaUploadResponse {
  batchId: string;
  keys: {
    video?: { key: string; iconKey: string };
    album?: { folder: string; coverKey: string; zipKey: string; tracks: Array<{ key: string; title: string }> };
  };
  firstAsset: { role: string; trackIndex?: number };
}
```

The server derives every key. The client never sends a key, URL, storage path, or content type that is not a literal enum. `keys` is authoritative and the only source for previews.

Validation, in this order:

1. Auth exists. Otherwise `unauthenticated`.
2. `users/{uid}/roles/admin === true` or `users/{uid}/roles/super === true`. Otherwise `permission-denied`. Read at `users/{uid}/roles` once.
3. Rate limit per uid: `rateLimit("media-create", uid, 20, 3600000)`. A breach is `resource-exhausted` with `Too many uploads. Try again later.`
4. `kind` is `video` or `audio-album`; `mode` is `create` or `replace`. Otherwise `invalid-argument`.
5. Names pass the naming rules:
   - Video `storageName` matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1 to 80.
   - Album `folderName` passes the folder rules, 1 to 100.
   - Every track filename passes the track rules.
   - Duplicate track filenames are rejected with `Two tracks use the same file name: "<file>". Rename one track file before uploading.`
   - Track count is 1 to `MAX_TRACKS_PER_ALBUM`.
6. Sizes are positive integers within the caps; content types exactly match the literal enum; the sum of album track sizes is at most `MAX_ALBUM_TRACK_BYTES`. Otherwise `invalid-argument` with the limit in the message.
7. `mode === "replace"` requires a `mediaId`, an existing managed video record, and kind `video`. The derived keys must equal the record's `storage.key` and `storage.iconKey`. A missing `thumbnail` reuses the existing icon key. Album replacement is rejected with `failed-precondition` and `Album content cannot be replaced. Delete the album and upload it again.`
8. Derive keys with the naming module. For create mode, HEAD every key and query `media` by `fileName` (video) or `folderName` (album). A record match returns `already-exists` with `A record named "<key>" already exists. Delete it or choose a different name.` An object without a record returns `already-exists` with `An orphan file named "<key>" exists. Choose a different name; the storage sweep will remove it later.`
9. Write `mediaUploads/{batchId}` with status `ticketed`, `lastActivityAt`, the real uid, and the derived asset list.
10. For every asset larger than `MULTIPART_THRESHOLD_BYTES`, call `CreateMultipartUpload` with metadata `{ "upload-batch": batchId }` and store the `uploadId`. In emulator mode always use a single PUT.
11. Return the batch id, the authoritative keys, and the first asset to ticket.

No partial success: if any validation, HEAD, query, or multipart initiation fails, no batch is written and nothing is returned.

### Callable: `resumeMediaUpload`

New file `functions/src/resume-media-upload.ts`. Export from `functions/src/index.ts`. Same region and secrets.

Request: `{ batchId: string, role: string, trackIndex?: number, partNumbers?: number[], verifyOnly?: boolean }`.

Response: `{ uploads: Array<SinglePutTicket | MultipartPartTickets>, verification?: { exists: boolean, batchMatches: boolean, size?: number, contentType?: string } }`, where a single ticket is `{ role, key, mode: "single", url, method: "PUT", headers, expiresAt }` and a multipart ticket is `{ role, key, mode: "multipart", uploadId, partSize, partCount, parts: Array<{ partNumber, url, headers }> }`.

Behavior:

1. Admin check, `rateLimit("media-resume", uid, 500, 3600000)`, and `rateLimit("media-resume-batch", batchId, 400, 3600000)`. A 100-track album needs at most a few hundred calls with retries.
2. Load the batch. Reject a foreign uid or status other than `ticketed` with `failed-precondition`.
3. Resolve the requested asset by role and track index. Missing asset is `invalid-argument`.
4. For a single asset, presign `PutObjectCommand` for `TICKET_TTL_SECONDS` with:
   - `signableHeaders: new Set(["content-type", "x-amz-meta-upload-batch"])`
   - `ContentType` from the batch
   - `Metadata: { "upload-batch": batchId }`
   - create mode: `IfNoneMatch: "*"`
   - replace mode: `IfMatch` the ETag read from the current object at this call.
5. For a multipart asset, presign up to 100 `UploadPartCommand` URLs per call for the requested part numbers. Part metadata rides on the CreateMultipartUpload call; parts carry only the URL and part number.
6. When `verifyOnly` is true, skip presigning. HEAD the asset, compare `x-amz-meta-upload-batch` with `batchId`, and return `verification`. This is the 412 disambiguation path: a create-mode 412 caused by a lost PUT response is the caller's own object, not a name collision.
7. Update `lastActivityAt`. Return the tickets or verification.

The client calls `resumeMediaUpload` immediately before each PUT, and again after a reload with the same `batchId` from session storage. This is the lazy-mint and resume path in one callable.

### Callable: `finalizeMediaUpload`

New file `functions/src/finalize-media-upload.ts`. Export from `functions/src/index.ts`. Same region and secrets.

Request:

```ts
interface FinalizeMediaUploadRequest {
  batchId: string;
  metadata: {
    title: string;
    date: string;
    artist?: string;
    isSticky?: boolean;
    isHidden?: boolean;
    duration?: string;
  };
  trackTitles?: string[];
  parts?: Array<{ role: string; trackIndex?: number; partNumber: number; etag: string }>;
}
```

No key, URL, filename, or folder field is accepted. Everything except display metadata and multipart part identities comes from the batch. `role` and `trackIndex` select a batch asset; they are not S3 keys.

Validation and behavior:

1. Admin check and `rateLimit("media-finalize", uid, 60, 3600000)`.
2. Load the batch. If `status === "finalized"` with a `resultId`, return `{ id: resultId, record }` without writing. If `status === "finalizing"`, return `failed-precondition` with `Finalize already in progress.`
3. Claim the batch in one transaction: if `status === "ticketed"`, set `status: "finalizing"` and bump `lastActivityAt`; if `status === "finalized"` with a null `resultId`, allow a retry claim; otherwise fail. A concurrent caller loses the transaction and gets `Finalize already in progress.`
4. Normalize metadata: `title` 1 to 200 characters after trim; `date` 4 to 40 characters; `duration` matches `^\d{1,}:\d{2}(?::\d{2})?$` or is empty. For albums, `trackTitles` must have exactly one 1 to 200 character title per batch track, in batch order.
5. For every batch asset:
   - Single PUT: HEAD the object.
   - Multipart: require the client's part list. Call `ListParts`, verify every part number, size, and ETag, then call `CompleteMultipartUpload`, then HEAD.
   - Verify the object exists, its actual size is within the cap, its content type matches, and `x-amz-meta-upload-batch` equals this `batchId`. A missing object, foreign batch, oversize object, or content-type mismatch is `failed-precondition` with `Upload not found or invalid for "<key>". Upload the file again.` Oversize and foreign objects are deleted before the error returns.
6. Derive URLs from the batch keys with the naming module. No client URL is accepted.
7. Build the records. For video, use one id: `mediaId` in replace mode, otherwise a new push id. For album, create an album id and one track id per batch track, preserving batch order, and stamp `storage.albumId` on every track.
8. Write one root `update` containing all `media/{id}` entries plus `mediaUploads/{batchId}/status`, `resultId`, and `finalizedAt`. The transaction claim plus this single atomic update makes a repeated or concurrent finalize safe. Reject more than 100 tracks before building the update, so the 256 path limit is never approached.
9. Invalidate only on replace. New keys are cache misses, so create does not spend an invalidation. In emulator mode this is a no-op.
10. Return `{ id, record }`, where `record` is the album with `listing` filled. Track records are not echoed separately.

Replace mode rules:

- Only video is supported.
- The batch keys must equal the record's `storage.key` and `storage.iconKey`.
- If the batch has no thumbnail asset, reuse `storage.iconKey` and leave the existing icon object in place.
- The record keeps its id. `storage.batchId` is updated to the new batch. No uploader or update hash is written to the public record.
- Finalize fails if the record disappeared between ticket and finalize.

### Callable: `updateMediaMetadata`

New file `functions/src/update-media-metadata.ts`. Export from `functions/src/index.ts`.

Request: `{ mediaId: string, title: string, date: string, isSticky: boolean, isHidden: boolean, duration?: string, trackTitles?: string[], listing?: string[] }`.

Behavior: admin check and `rateLimit("media-update", uid, 120, 3600000)`; load `media/{mediaId}`; 404 if missing; validate with the same metadata validator as finalize. For a video, `duration` is optional and validated. For an album, `trackTitles` and `listing` must be supplied together, have the same length as the current listing, and `listing` must be a permutation of the current ids. Write only `title`, `date`, `isSticky`, `isHidden`, `duration` when present, `listing` when present, `dateUpdated`, and each track's `title` when present, in one root update. Never touch keys, URLs, `storage`, type, or format. Return the updated record, with track records for an album. This is the only path for track title and order fixes; byte changes still mean delete and re-upload.

### Callable: `deleteMedia`

New file `functions/src/delete-media.ts`. Export from `functions/src/index.ts`.

Request: exactly one of `{ mediaId: string }` or `{ batchId: string }`.

Behavior:

1. Admin check and `rateLimit("media-delete", uid, 60, 3600000)`.
2. For `mediaId`, load `media/{mediaId}`. If it is missing, read `mediaDeletions/{mediaId}` and resume a pending deletion; otherwise `not-found`. The deletion id equals the root media id, so no secondary index is needed.
3. Resolve the cascade. For an album, read every `listing` track. For a track, use `storage.albumId` to read the parent album.
4. If the record, its tracks, or the parent has no `storage.managed`, remove only the database records and return `{ id, objectsDeleted: 0, warnings: [] }`. Legacy behavior stays DB-only, as today.
5. Collect every managed key: video `storage.key` and `storage.iconKey`; album `storage.trackKeys`, `storage.coverKey`, and `storage.zipKey`; a single track `storage.key` plus its parent's listing rewrite.
6. Delete objects with `DeleteObjectsCommand`, at most 1000 keys per call, then HEAD every key to verify 404. If any object remains, abort before touching records and return `failed-precondition` with `Could not delete "<key>". Retry the delete.` Records stay intact, so nothing is half-deleted and no content is silently left public under a removed record.
7. After all objects are verified gone, write a `mediaDeletions` entry with status `pending` and the exact keys.
8. Remove the records in one root update. For a track, also rewrite the parent album's `listing` and `trackKeys`. Set the deletion entry to `completed`.
9. Invalidate the deleted URL paths. In emulator mode this is a no-op. Deletes use one wildcard per album folder where possible to conserve the monthly path budget.
10. Return `{ id, objectsDeleted, warnings }`. A record-removal failure after object deletion returns a warning and leaves the deletion entry pending; a retry with the same id resumes from step 7.
11. `deleteMedia` also accepts `{ batchId }` with no `mediaId`. That is the cancel path: verify the batch belongs to the caller, delete every ticketed asset and abort every multipart upload, then remove the batch. It returns `{ batchId, objectsDeleted }`.

### Scheduled Callable: `sweepMediaUploads`

New file `functions/src/sweep-media-uploads.ts`. Export from `functions/src/index.ts` as an `onSchedule` function in `REGION`, daily.

Behavior:

- Query `mediaUploads` by `lastActivityAt` older than `SWEEP_GRACE_MS`, 100 at a time, using an index. Reject and skip any batch newer than the grace window.
- For `ticketed` and `finalizing` batches, check whether any `media/{id}` record has a matching `storage.batchId`. If none, delete every asset and abort every multipart upload, then remove the batch. If records exist, mark the batch `finalized` with the first record id, so a completed write is never undone.
- For `mediaDeletions` with status `pending`, retry the object deletes and verify 404, then mark completed.
- Never touch objects that no batch references. Manual or legacy files are out of scope.
- Log counts only: batches scanned, objects deleted, multipart uploads aborted.

### Storage Adapter

New file `functions/src/media/storage-adapter.ts`.

```ts
interface StorageAdapter {
  presignPut(input: {
    key: string;
    contentType: string;
    batchId: string;
    mode: "create" | "replace";
    etag?: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers: Record<string, string>; expiresAt: number }>;
  createMultipart(input: {
    key: string;
    contentType: string;
    batchId: string;
  }): Promise<{ uploadId: string }>;
  presignParts(input: {
    key: string;
    uploadId: string;
    partNumbers: number[];
    expiresInSeconds: number;
  }): Promise<Array<{ partNumber: number; url: string }>>;
  listParts(key: string, uploadId: string): Promise<Array<{ partNumber: number; size: number; etag: string }>>;
  completeMultipart(input: { key: string; uploadId: string; parts: Array<{ partNumber: number; etag: string }> }): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
  head(key: string): Promise<{ exists: boolean; size?: number; contentType?: string; metadata?: Record<string, string> }>;
  deleteMany(keys: string[]): Promise<{ deleted: number; warnings: string[] }>;
  invalidate(paths: string[]): Promise<void>;
}
```

Production implementation uses `S3Client` with `MEDIA_AWS_REGION` and explicit credentials from the secrets. Every presign call passes `signableHeaders: new Set(["content-type", "x-amz-meta-upload-batch"])` and, for replace, also `if-match`. Emulator implementation delegates to the sink module and always returns a single PUT, never multipart.

### Emulator Media Sink

New file `functions/src/emulator-media-sink.ts`. Export `emulatorMediaSink` from `functions/src/index.ts` as an HTTPS `onRequest` function in `REGION`.

- Store objects in a module-level `Map<string, { body: Buffer; contentType: string; metadata: Record<string, string>; etag: string }>`.
- If `process.env.FUNCTIONS_EMULATOR !== "true"`, every request returns 404 with an empty body. This is the production guard.
- `PUT /emulatorMediaSink?key=<encoded>`: store the raw body, `content-type`, `x-amz-meta-upload-batch`, and a deterministic ETag. Honor `If-None-Match: *` with 412 when the key exists and `If-Match` with 412 when the ETag differs. Return 200 with an `ETag` header.
- `HEAD` and `GET /emulatorMediaSink?key=<encoded>`: emulator only. Return 200 with `Content-Type`, `Content-Length`, `ETag`, and `x-amz-meta-upload-batch`, or 404. Support a single `Range` request with 206 and `Content-Range` so native video elements behave.
- `POST /emulatorMediaSink?reset=1` clears the map. It is emulator-only and is called by the Playwright global setup once per browser project, because all three projects share one functions process.
- `OPTIONS` returns 204 with `Access-Control-Allow-Origin: http://localhost:5000`, `Access-Control-Allow-Methods: GET, HEAD, PUT, OPTIONS`, `Access-Control-Allow-Headers: content-type, if-none-match, if-match, x-amz-meta-upload-batch`, and `Access-Control-Max-Age: 3600`. All responses include `Access-Control-Allow-Origin: http://localhost:5000`.
- Sink URLs are `http://localhost:5001/<project>/us-central1/emulatorMediaSink?key=<encoded>` with the project from `GCLOUD_PROJECT`, defaulting to `lecoursville-dev`.
- Multipart is never used in emulator mode. The adapter returns single PUT tickets for every size, so the e2e path stays one request per asset.
- The sink module exposes test helpers `resetSink()`, `sinkHead(key)`, `sinkGet(key)`, and `sinkMetadata(key)` for vitest. They are not callable over HTTP.
- In emulator mode, `MEDIA_BASE_URL` is the sink base without a query string. Stored download URLs append `?key=<encoded key>`; stored icon URLs do the same. This is the only place the emulator URL shape differs from production.

Expect the e2e bundle to load media from `localhost:5001`. That is cross-origin from the hosting emulator, so the sink's CORS headers are required for the XHR PUT and for any canvas work. Playback itself does not require CORS.

### CloudFront Invalidation

Invalidate only where correctness requires it: replace and delete. A new object is a cache miss, so create never invalidates. Paths are `"/" + key` with `encodeURI` applied per path segment. For an album delete, use one wildcard per folder (`/Music/Albums/<folder>/*`, `/Music/Albums/Covers/<folder>.jpg`, `/Music/Albums/Zips/<folder>.zip`) so 100 tracks cost three paths, not 100. CloudFront gives 1000 free paths per month, then charges per path; track the count in logs and document the budget. Failures are logged and surfaced as warnings; they never fail the callable after records are written.

### Database Rules

Add to `database.rules.json`:

```json
"mediaUploads": {
  ".read": false,
  ".write": false
},
"mediaDeletions": {
  ".read": false,
  ".write": false
}
```

Add `".indexOn": ["fileName", "folderName"]` to the existing `media` node and `".indexOn": ["lastActivityAt"]` to `mediaUploads`. No other rule change. The existing `media` node stays public read and admin write (`database.rules.json:140-143`).

### Functions Configuration

Add to `functions/src/media/config.ts`:

```ts
export const MEDIA_AWS_REGION = defineSecret("MEDIA_AWS_REGION");
export const MEDIA_AWS_ACCESS_KEY_ID = defineSecret("MEDIA_AWS_ACCESS_KEY_ID");
export const MEDIA_AWS_SECRET_ACCESS_KEY = defineSecret("MEDIA_AWS_SECRET_ACCESS_KEY");
export const MEDIA_S3_BUCKET = defineSecret("MEDIA_S3_BUCKET");
export const MEDIA_CLOUDFRONT_DISTRIBUTION_ID = defineSecret("MEDIA_CLOUDFRONT_DISTRIBUTION_ID");
```

Bind all five on `createMediaUpload`, `resumeMediaUpload`, `finalizeMediaUpload`, `updateMediaMetadata`, and `deleteMedia`. The scheduled `sweepMediaUploads` also binds the S3 and CloudFront secrets. `emulatorMediaSink` binds none.

Set `timeoutSeconds: 300` on `finalizeMediaUpload` and `sweepMediaUploads`, `120` on `deleteMedia`, and leave create, resume, and update at `60`. Set `memory: "256MiB"` on all five callables. Import the AWS clients with `await import(...)` inside the handler so the shared functions bundle does not pay their cost on auth and recovery cold starts. Do not log secret values, presigned URLs, or object bytes.

## Frontend And UI Requirements

### Shared Upload Client

New service `src/app/services/media-upload.service.ts`.

- `createBatch(request)` calls `createMediaUpload` through the existing `CloudFunctionsService` pattern. `CloudFunctionsService` already wraps `httpsCallable<Input, Output>` (`src/app/services/cloud-functions.service.ts:43`), so reuse it and add typed media methods.
- `resume(batchId, role, trackIndex?, partNumbers?)` calls `resumeMediaUpload` and returns single or multipart tickets.
- `putSingle(ticket, file)` uses Angular `HttpClient.put` with `observe: "events"`, `reportProgress: true`, and the ticket headers. It maps progress to `{ loaded, total, percent }` and returns an observable that unsubscribes into an abort. It never reads the file into memory.
- `putParts(ticket, file)` slices the file with `File.slice` into `partSize` chunks, uploads three at a time, retries each part twice, and collects `{ partNumber, etag }` from the response. Progress is weighted by completed bytes. An abort cancels in-flight parts.
- `finalize(request)` calls `finalizeMediaUpload` and sends collected part ETags.
- `updateMetadata(request)` calls `updateMediaMetadata`.
- `deleteRecord(mediaId)` and `cancelBatch(batchId)` call `deleteMedia`.
- Persist `{ batchId, kind, mode, storageName, folderName, createdAt }` in `sessionStorage` under `mediaUploadBatch:<batchId>`. On page load, if a ticketed batch is present, show a `Resume upload` action. Resume calls `resumeMediaUpload` for assets that have no completed marker; the marker is the local part/asset state, not a second server record.
- A completed asset is recorded in a local `Set` only after the PUT returns 200. On reload, re-check by attempting finalize; a `failed-precondition` with `Upload not found` reopens the missing asset instead of duplicating it.
- Error mapping: `already-exists` to the duplicate message. HTTP 412 from a create-mode ticket first calls `resumeMediaUpload({ ..., verifyOnly: true })`; when `batchMatches` is true the PUT is treated as successful and the flow continues, otherwise the duplicate message is shown. HTTP 412 from a replace-mode ticket maps to `The file changed while you were replacing it. Retry the upload.` and a fresh ticket. `failed-precondition` with an upload-not-found message goes to the resume path. `resource-exhausted` maps to its message. `permission-denied` maps to `You do not have permission to upload media.`. Everything else maps to the generic retry message.
- A failed finalize keeps the uploaded objects and exposes `retryFinalize()` so the admin never re-uploads bytes.

### Video Tab

Replace the body of `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html` and rewrite the component logic. Keep the existing admin gate, card classes, success and error regions, action row, list, selection, and delete flow.

Fields and controls, in order:

1. File drop zone with a hidden `input[type=file][accept="video/mp4,.mp4"][data-testid="video-file-input"]`. On selection: require a `.mp4` extension, accept an empty MIME or `video/mp4`, reject over 2 GiB with `That file is larger than 2 GB.`, then read metadata.
2. Title input `name="videoTitle"`, prefilled from the filename when empty. Filename to title: strip extension, replace runs of `_` or `-` with one space, trim. Editable.
3. Date input `name="videoDate"`, prefilled with the current four-digit year. Editable.
4. Storage name input `name="videoStorageName"`, prefilled with the derived slug. Validation message `Use only lowercase letters, numbers, and single dashes in the storage name.`
5. Path preview `data-testid="video-path-preview"` showing `Video/<name>.mp4` and `Video/Icons/<name>.jpg`. Before upload it is marked `provisional`. After `createMediaUpload` returns, replace it with the authoritative `keys` from the response and drop the provisional marker.
6. Thumbnail preview `<img data-testid="video-thumbnail-preview">`, a range slider `name="videoThumbnailTime"` with an associated visible label `Thumbnail frame`, from 0 to duration with step 0.1, and a manual override `input[type=file][accept="image/jpeg,image/png,image/webp"][data-testid="video-thumbnail-input"]`. The label reads `Choose thumbnail image`.
7. Sticky and hidden checkboxes, unchanged.
8. Action row: Upload or Update, Clear, Delete when editing, and Retry when finalize failed. Keep the existing button classes so the card-layout e2e test stays valid.

Behavior:

- Selecting a file starts frame capture and metadata read with deterministic events, never timers. Use `loadedmetadata`, then `requestVideoFrameCallback` when available and `seeked` otherwise, then `canvas.toBlob`. Do not seek to exactly 0, where `seeked` may not fire.
- Capture at `Math.min(Math.max(duration * 0.1, 0.05), Math.max(duration - 0.1, 0.05))`. Scale to a maximum width of 1280 and a maximum height of 720, preserve aspect ratio, encode JPEG at quality 0.82.
- If capture fails for any reason, clear the preview, show `Automatic thumbnail failed. Choose a thumbnail image.`, and require the override input.
- Manual images are decoded, scaled with the same bounds, and re-encoded to JPEG so the stored object is always `.jpg`.
- Duration is formatted as `mm:ss` under one hour, `hh:mm:ss` at or above one hour. If the reported duration is not finite or is zero, leave `duration` empty and require the manual thumbnail override.
- Upload sequence: `createMediaUpload`, then for each asset `resumeMediaUpload` immediately before its PUT, then `finalizeMediaUpload`. Progress text is `Uploading video 42%.`, then `Uploading thumbnail...`, then `Saving record...`. Files above 100 MiB use part uploads and show `Uploading video 42% (part 12 of 30).`
- Cancel aborts in-flight requests and calls `deleteMedia({ batchId })` so a canceled upload does not block the name. If the cancel cleanup fails, show `Upload canceled, but cleanup failed. The storage sweep will remove the file.`
- Success message: `Saved "<title>".`. Reset all fields and previews and clear the session-storage batch.
- Duplicate message: `A record named "<key>" already exists. Delete it or choose a different name.` The orphan variant is passed through from the callable.
- Finalize failure: `The file uploaded but the record could not be saved. Choose Retry to finish saving.` Retry calls finalize only.
- Upload failure: `Couldn't upload "<filename>". Check your connection and try again.`
- A dropped connection or reload with a ticketed batch shows `Resume upload`. Resume re-requests tickets for assets without a local completion marker and never re-sends a completed asset.
- Edit mode: selecting a row loads metadata and hides file, thumbnail, and storage-name controls. Save calls `updateMediaMetadata`, including `duration`. Show a `Replace video file` checkbox; when checked, reveal the file input and an optional thumbnail input. A missing thumbnail reuses the existing icon key.
- Delete calls `deleteMedia`. Success message `Deleted "<title>".`. If object deletion fails, the record stays and the message is `Could not delete "<title>". Nothing was removed. Retry the delete.`
- The whole card remains admin-gated.
- Accessibility: every control has a visible label or `aria-label`; progress and errors live in `role="status"` and `role="alert"` regions with `aria-live`; tab order follows the form; after success or a blocking error, focus returns to the card heading or the first invalid field.

Exact validation messages for tests:

- No file: `Choose an MP4 file.`
- Wrong type: `Choose an MP4 file.`
- Missing title: `Enter the title before uploading.`
- Missing date: `Enter the date before uploading.`
- Missing storage name: `Enter a storage name.`
- Invalid storage name: `Use only lowercase letters, numbers, and single dashes in the storage name.`
- Missing thumbnail after a failed capture: `Choose a thumbnail image.`

### Audio Album Tab

Replace the body of `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.html` and rewrite the component logic. Keep the admin gate, card classes, success and error regions, action row, list, selection, and delete flow.

Fields and controls, in order:

1. Title input `name="albumTitle"`, editable.
2. Folder input `name="albumFolderName"`, prefilled from the title when empty and only when the admin has not edited it. Validation and helper text show `Music/Albums/<folder>/`.
3. Date input `name="albumDate"`, prefilled with the current four-digit year.
4. Track drop zone with a hidden `input[type=file][multiple][accept="audio/mpeg,.mp3"][data-testid="album-tracks-input"]` and a folder picker button using `webkitdirectory`. Feature-detect `webkitdirectory` and hide the folder button where unsupported, especially iOS and iPadOS before 18.4. The multi-file input is the primary path and stays visible.
5. Track list `data-testid="album-track-list"` with one row per file: derived title input, filename, size, up and down buttons, and remove. Order is the upload order and the `listing` order. Default order is natural sort by filename, so `2 - Song.mp3` sorts before `10 - Song.mp3`.
6. Cover preview `data-testid="album-cover-preview"`, a status line `data-testid="album-cover-source"` reading `From track art` or `Custom image`, and an override input `[data-testid="album-cover-input"]`.
7. Zip control. When total track bytes are at or below `BROWSER_ZIP_MAX_BYTES`, generate the zip in the browser with `jszip` during upload and show `Album zip will be generated (123 MB).` with an optional `Use my own zip` input. When total bytes exceed the cap, require `name="albumZip"` accepting `.zip`, with helper text `Albums over 500 MB need a zip file.` The zip is always the album download.
8. Sticky and hidden checkboxes, unchanged.
9. Action row: Upload or Update, Clear, Delete, and Retry.

Behavior:

- On track selection, read ID3v2 cover art from the first selected track. Scan at most the first 8 MiB of the file.
- Support ID3v2.2 `PIC` and ID3v2.3 and ID3v2.4 `APIC`. Handle plain and syncsafe frame sizes. Accept `image/jpeg` and `image/png`. Ignore unsynchronisation and compressed frames; fall back to manual.
- Decode the image, scale to a maximum of 1000 by 1000, preserve aspect ratio, encode JPEG at quality 0.85.
- If no art is found or decoding fails, show `Add a cover image.` and require the override input. A custom image follows the same scale and JPEG conversion.
- Zip generation runs after the tracks are selected and before `createMediaUpload`, so the callable receives the real zip size. Use `jszip` with `{ type: "blob", compression: "STORE" }`; audio is already compressed, so deflate only burns CPU. If generation throws, show `Album zip generation failed. Retry or choose a zip file.` and do not start the upload. Above the cap, use the manual input.
- Upload sequence: `createMediaUpload` with cover, zip, and every track; then for each asset `resumeMediaUpload` immediately before its PUT, with tracks in list order and progress `Uploading track 2 of 7 (35%).`; then finalize with the full order preserved.
- Success message: `Saved album "<title>".`. Reset all fields, tracks, cover, and zip, and clear the session-storage batch.
- Validation messages:
  - No tracks: `Add at least one MP3 track.`
  - Non-MP3 track: `Only MP3 tracks can be added.`
  - Track too large: `Each track must be 200 MB or smaller.`
  - Duplicate track filename: `Two tracks use the same file name: "<file>". Rename one track file before uploading.`
  - No cover: `Add a cover image.`
  - No zip above the cap: `Albums over 500 MB need a zip file.`
  - Wrong zip type: `Albums over 500 MB need a zip file.`
  - Zip generation failed: `Album zip generation failed. Retry or choose a zip file.`
  - Missing folder: `Enter the folder name before uploading.`
  - Invalid folder: `Use a folder name without slashes or special characters.`
  - Duplicate folder: `A folder named "<folder>" already exists. Delete the existing album or choose a different folder name.`
- Edit mode: selecting an album loads metadata, track titles, and order; hides cover, zip, folder, and track add or remove controls. Save calls `updateMediaMetadata` with edited titles and `listing` order. Adding or removing tracks remains out of scope and is explained in the helper text: `To change tracks, delete this album and upload it again.`
- Delete calls `deleteMedia`, which cascades album and tracks, deletes and verifies objects, then removes records. If object deletion fails, nothing is removed and the message is `Could not delete "<title>". Nothing was removed. Retry the delete.`
- Accessibility: visible labels for folder, zip, cover, and track controls; `aria-live` on progress and errors; the track list is keyboard reorderable with up and down buttons that move focus with the row; after success or a blocking error, focus returns to the card heading or the first invalid field.

### Player

No new component. Branch inline in the explorer template at `src/app/components/media-explorer/media-explorer.component.html:45-54`:

- Add `isExternalDriveUrl(media)` to `MediaExplorerComponent`, true when `urls.download` starts with `https://drive.google.com/`.
- Drive URLs render the existing `app-video-player-drive-iframe` unchanged, preserving legacy behavior and the shared-link e2e test.
- All other URLs render `<video data-testid="native-video-player" class="video-element" controls preload="metadata" [src]="selectedMedia.urls.download" [poster]="selectedMedia.urls.icon">`.
- Keep the Drive component declared; no new player component, module entry, or pair of files.

### Admin List Behavior

- Managed records continue to appear through the existing media list. No list change is required.
- Deleting through the list uses the new callable. Replace the two admin call sites at `admin-media-upload-video.component.ts:87` and `admin-media-upload-audio-album.component.ts:94`; keep `MediaService.deleteMedia` only for non-admin or legacy paths that still need it.
- The edited video's duration, title, date, sticky, and hidden fields stay editable through `updateMediaMetadata`. Album track titles and order are editable through the same callable.
- Remove the dead `JsonService` media write path at `src/app/services/json.service.ts:114` and `:135` so no client path can bypass the managed pipeline. If a bulk import is still wanted later, it becomes its own spec.

## Production Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Bucket CORS missing or wrong, producing opaque browser failures | Prerequisite JSON, a preflight smoke check in the rollout, and a specific error message rather than a generic failure |
| Presigned URL expires during a long upload | 15-minute tickets minted per asset immediately before use, plus `resumeMediaUpload`; a ticket held across a long multipart part is re-minted |
| Duplicate storage name race between two admins | `If-None-Match: *` on create-mode PUT plus HEAD at ticket and finalize; a concurrent loss is a 412, never a silent overwrite |
| Replace overwrites newer bytes | `If-Match` with the current ETag; a 412 means stale content and mints a fresh replace ticket |
| CloudFront serves a stale object after replace | Invalidate only on replace and delete; new objects are cache misses; wildcard album paths keep the 1000-path monthly budget in view |
| Finalize succeeds but the response is lost, then retried | Transaction claim to `finalizing`, then records and status in one atomic update; a null `resultId` is recoverable |
| Album partial write leaves orphan tracks | Single root multi-path update for album, tracks, and batch status |
| Delete leaves public content or dangling records | Delete and verify objects first, then records; a deletion ledger retries a failed record removal; an object failure aborts with records intact |
| Aborted uploads leave orphan objects | Cancel calls `deleteMedia({ batchId })`; the daily sweeper removes stale ticketed assets; the bucket lifecycle rule aborts incomplete multipart uploads |
| Playwright Chromium cannot decode H.264, making frame capture flaky | E2E uses the deterministic manual thumbnail override; frame capture math and `requestVideoFrameCallback` fallback are unit-tested |
| Emulator sink leaks into production | 404 guard when `FUNCTIONS_EMULATOR` is not `true`, plus a vitest assertion |
| AWS SDK inflates function cold start and bundle | Dynamic `await import` inside media handlers; cold-start p95 measured in Phase 4 |
| Secrets leak through logs | Never log tickets, URLs, credentials, or bytes; log keys only on validation failures |
| Public `media` node leaks admin identity | No uploader field in the public record; the real uid stays in the server-only batch and deletion ledgers |
| Album zip is not a real zip | Browser-generated zips are real; a manual zip is admin-only and validated by size and type, not content |
| Large browser memory use | Track files are streamed to multipart slices, not held whole; jszip is capped at 500 MB; only the thumbnail and ID3 scan buffer are in memory |
| Rate-limit exhaustion blocks a legitimate large album | Limits are per batch and per uid with headroom for 100 tracks; resume shares the per-batch budget |
| Multipart CORS or IAM gap | Part PUTs need only PUT; create and complete run in the Function; IAM includes AbortMultipartUpload and ListMultipartUploadParts; a lifecycle rule cleans incomplete uploads |
| Phase 1 deploy fails on unset secrets | Secrets, CORS, IAM, and the lifecycle rule are Phase 0 prerequisites, not Phase 1 work |

## Rollout Plan

### Phase 0: Prerequisites

Create the five secrets in both projects, apply the bucket CORS, IAM policy, and lifecycle rule, and confirm both dev origins. No media callable deploys before this phase completes. This resolves the deploy-failure contradiction in the earlier plan.

### Phase 1: Backend

Ship `functions/src/media/*`, `createMediaUpload`, `resumeMediaUpload`, `finalizeMediaUpload`, `updateMediaMetadata`, `deleteMedia`, `sweepMediaUploads`, the emulator sink, the rules and indexes, the function dependencies, and all functions and naming unit tests. No UI change yet. The app keeps working through the old typed-filename form. Deployable and reversible by removing the new exports if needed; the secrets stay.

### Phase 2: Video Upload UI And Lifecycle

Ship the video form rewrite, the shared upload client, the inline player branch, the seed additions, managed delete, replace, resume, cancel, and the video e2e cases, including replace, cancel, and retry. Remove the old typed-filename video path. The audio tab stays as is for one deploy if needed. This phase owns every user-visible video behavior it ships.

### Phase 3: Audio Album UI And Zip

Ship the album form rewrite, ID3 parser, cover pipeline, browser zip generation with the 500 MB cap and manual fallback, track title and order edits, and the album e2e cases. Remove the old track-textarea path. This phase owns every user-visible audio behavior it ships.

### Phase 4: Verification Only

No new wiring. Run the full gate on all three browsers, measure cold-start p95 with the AWS clients dynamically imported, verify the real bucket and CloudFront with the manual checklist, and confirm the invalidation count for one album create, replace, and delete stays within the monthly budget.

Every phase keeps `npm run e2e:gate` green. The gate runs the real UI against the emulator sink, so a red gate blocks the deploy as usual.

## Test Plan

### Functions Unit Tests

`functions/src/media/naming.spec.ts`:

- Video slug: punctuation, accents, uppercase, repeated separators, leading and trailing separators, empty input, 80-character truncation.
- Video URLs: plain name, hyphenated name, extension handling.
- Audio folder: spaces to plus, repeated spaces, leading and trailing spaces, forbidden characters, empty input, 100-character truncation.
- Audio track filename and title derivation, including `+` preservation in the filename and space conversion in the title.
- `encodeURI` leaves `+` intact and encodes non-ASCII.

`functions/src/create-media-upload.spec.ts`:

- Unauthenticated, user-only, admin, and super callers.
- Rate limit rejects the 21st create in an hour for one uid.
- Unknown kind, mode, content type, and size are rejected.
- Invalid video, folder, and track names are rejected; `%`, `?`, `#`, and `&` are refused.
- Duplicate track filenames are rejected with the documented message.
- One hundred tracks are accepted; one hundred and one are rejected.
- A record duplicate and an orphan object produce different `already-exists` messages.
- Replace requires a managed video record; a missing thumbnail reuses the icon key; album replace is rejected.
- Assets above the multipart threshold get `CreateMultipartUpload` with batch metadata; smaller assets stay single PUT.
- The batch ledger stores derived keys, the real uid, `ticketed`, and `lastActivityAt`.
- No batch is written when validation, HEAD, query, or multipart initiation fails.

`functions/src/resume-media-upload.spec.ts`:

- Foreign uid, wrong status, and unknown role or track index are rejected.
- Rate limit uses the per-batch budget.
- A single ticket signs content-type, batch metadata, and `If-None-Match` for create or `If-Match` for replace.
- Multipart parts paginate at 100 per call and preserve part numbers.
- `lastActivityAt` advances on every resume.
- A completed asset does not trigger a duplicate HEAD rejection.

`functions/src/finalize-media-upload.spec.ts`:

- Missing batch, foreign uid, and non-admin caller are rejected.
- A `finalizing` batch returns `Finalize already in progress.`
- Two concurrent finalizes: one claims the transaction, one fails, and only one set of records exists.
- `finalized` with a `resultId` returns the existing record; `finalized` with a null `resultId` retries cleanly.
- Metadata validation accepts `3:45` and rejects an empty title or a bad duration.
- Album `trackTitles` count must match the batch.
- Single PUT missing, wrong size, wrong type, or wrong batch metadata is rejected.
- Multipart missing part, wrong part size, wrong ETag, or oversize total is rejected; oversize objects are deleted.
- A valid video finalize writes the expected record, URLs, and storage stamp, with no uploader field.
- A valid album finalize writes the album plus N tracks atomically, preserves order, and stamps `storage.albumId`.
- Repeated finalize does not duplicate records.
- Replace reuses the existing icon when no thumbnail is supplied and invalidates exactly the object and icon paths.
- Create does not invalidate.
- Invalidation failure is logged but the record stands.

`functions/src/update-media-metadata.spec.ts`:

- Non-admin is rejected; a missing record is `not-found`.
- Duration is editable and validated; `3:45` is accepted.
- Album track titles and a permuted `listing` update atomically.
- A non-permutation listing or a title count mismatch is rejected.
- URLs, keys, `storage`, type, and format are untouched.

`functions/src/delete-media.spec.ts`:

- Legacy record removes the database record and performs no S3 calls.
- Managed video deletes and verifies both objects, then removes the record, then invalidates both paths.
- Managed album deletes all track, cover, and zip objects, verifies 404s, then removes the album and tracks with a wildcard invalidation.
- Deleting a track rewrites the parent album's `listing` and `trackKeys`.
- An object deletion failure aborts with the record intact and the documented error.
- A record removal failure leaves a pending `mediaDeletions` entry that a retry completes.
- `{ batchId }` cancel deletes ticketed assets and aborts multipart uploads without touching records.
- Non-admin is rejected and rate limit applies.

`functions/src/sweep-media-uploads.spec.ts`:

- A batch newer than the grace window is skipped.
- A stale ticketed batch deletes its assets and aborts its multipart upload.
- A stale `finalizing` batch with a matching record is marked finalized and its objects are kept.
- A pending `mediaDeletions` entry retries and completes.
- Objects not referenced by a batch are untouched.

`functions/src/emulator-media-sink.spec.ts`:

- All methods return 404 when `FUNCTIONS_EMULATOR` is not set.
- PUT stores bytes and metadata; `If-None-Match: *` returns 412 on an existing key; `If-Match` returns 412 on an ETag mismatch.
- HEAD reflects existence, size, content type, ETag, and batch metadata.
- GET returns the body; a Range request returns 206 with the correct `Content-Range`.
- `POST ?reset=1` clears state.
- Multipart is never requested in emulator mode.

### Angular Unit Tests

`src/app/services/media/media-naming.spec.ts`: the same slug, folder, path, and URL cases as the server module, plus an explicit parity check on a fixed table of inputs and expected outputs.

`src/app/services/media/id3-cover.spec.ts`:

- ID3v2.3 APIC with JPEG.
- ID3v2.3 APIC with PNG.
- ID3v2.4 APIC with a syncsafe frame size.
- ID3v2.2 PIC.
- No tag, truncated tag, zero-length image, unsupported image MIME.
- Scan limit respected.

`src/app/services/media/video-thumbnail.spec.ts`:

- Capture uses `requestVideoFrameCallback` when present and falls back to `seeked`.
- Seek time is 10 percent, clamped to 0.05 seconds at both ends.
- Scale math for landscape, portrait, small, and zero-dimension inputs.
- JPEG quality and MIME.
- Failure path returns null and requests the manual override.

`src/app/services/media/album-zip.spec.ts`:

- Zip generation under the cap uses `jszip` with `STORE` and includes every track in list order.
- Above the cap, generation is skipped and the manual input is required.
- A generation failure returns the documented error and starts no upload.
- The generated blob size and name match `Zips/<folder>.zip`.

`src/app/services/media-upload.service.spec.ts`:

- Sequence: create, resume per asset, single PUT or multipart parts, finalize with ETags.
- Multipart slices at `partSize`, uploads three at a time, retries a failed part twice, and collects ETags in order.
- Progress is weighted by completed bytes and reports part numbers.
- Abort unsubscribes in-flight requests and calls `cancelBatch`.
- A 412 on a create ticket calls verify-only resume; a matching batch continues the flow, a foreign batch shows the duplicate message. A 412 on a replace ticket maps to the stale-content message and re-tickets.
- Rate limits apply per uid and per batch, and a 100-track album stays under both.
- `resource-exhausted` maps to the rate-limit message.
- Finalize failure exposes retry without a new ticket or a new PUT.
- A session-storage batch offers resume and requests only assets without a local completion marker.

`src/app/components/admin-media-upload-video/admin-media-upload-video.component.spec.ts`:

- Every validation message and the preserved form state.
- Title prefill and storage-name prefill from a dropped filename.
- Frame capture success populates the preview; capture failure requires the manual input.
- The path preview switches from provisional to the ticket keys.
- Successful upload resets the form and clears session storage.
- Duplicate error keeps the form.
- Edit mode hides file controls and saves duration through the callable.
- Replace mode allows a missing thumbnail and reuses the icon.
- Cancel calls the batch cancel path.
- Delete reports the nothing-removed error when object deletion fails.
- Every control has a label and progress and errors have live regions.

`src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.spec.ts`:

- Folder prefill from title until manually edited; forbidden characters are rejected.
- Track ordering, move up, move down, remove, and keyboard focus movement.
- Duplicate track filenames are rejected before upload.
- Cover from ID3 art, cover override, missing cover.
- Zip is generated under the cap; a manual zip is required above it; a generation failure blocks upload.
- Successful upload resets the form and clears session storage.
- Edit mode hides content controls and saves track titles and order.
- The folder button is hidden when `webkitdirectory` is unsupported.
- Delete reports the nothing-removed error when object deletion fails.
- Every control has a label and progress and errors have live regions.

`src/app/components/media-explorer/media-explorer.component.spec.ts`:

- Drive URL renders the Drive iframe.
- CloudFront URL renders a native video with `src` and `poster`.
- Other external URLs render native video.
- A missing icon renders native video with no poster.

### E2E Tests

All cases live in `e2e/specs/media.spec.ts` unless noted. Every spec imports `test` from `e2e/helpers/fixture.ts`, uses deterministic waits, and cleans up with the Admin SDK.

Seed additions in `scripts/e2e/seed.mjs`:

- Write `fixture.mp4` to the hosting fixture directory. It must be a tiny valid H.264 MP4. It is used for file selection; thumbnail capture is not asserted in e2e.
- Write `01-fixture.mp3` and `02-fixture.mp3`, each with a valid ID3v2.3 tag containing an APIC frame with the existing `fixture.png`, plus a few silent MPEG frames. Two distinct names keep track keys unique in one album.
- Write `fixture-noart.mp3` with the same audio frames and no ID3 tag, for the missing-cover case.
- Write `fixture.zip` as a valid empty zip, for the manual zip override.
- Seed `media-video-s3` with `urls.download` pinned to `http://localhost:5000/assets/e2e-fixtures/fixture.mp4` and an icon URL, so the native player has a signed-out fixture. Do not seed a managed `storage` block for it; it tests the legacy record path.
- Add a Playwright global setup that calls `POST http://localhost:5001/lecoursville-dev/us-central1/emulatorMediaSink?reset=1` once per browser project, because the functions process is shared across all three.

Cases:

1. `explorer lists the seeded media entries`: update the old three-entry test to also expect the S3 video.
2. `signed-out shared link plays the referenced item`: unchanged for the Drive video; add a native branch that opens `media-video-s3` signed out and expects `[data-testid="native-video-player"]` with the fixture source and no auth prompt.
3. `video player renders a native element for a CloudFront URL`: signed in, open the S3 video, assert the native element and the poster attribute.
4. `video upload saves a managed record with derived URLs`: drop `fixture.mp4`, accept the prefilled title, set the date, set a unique storage name `e2e-<timestamp>`, supply `fixture.png` through the override input, upload, expect the success message, read `media` with the Admin SDK, find the record by title, and assert `type`, `format`, `urls.download`, `urls.icon`, `fileName`, `storage.managed`, `storage.key`, and `storage.iconKey`. Assert `storage.uploadedByHash` is absent. Assert the sink has both objects and both carry the batch metadata.
5. `video upload keeps the form and shows the duplicate message`: upload once, then attempt the same storage name again and assert the exact record-duplicate message and preserved values.
6. `video upload rejects a non-MP4 file`: select `fixture.wav` and assert `Choose an MP4 file.` with no record written.
7. `video upload requires a title and date`: clear date, assert `Enter the date before uploading.`, clear title, assert `Enter the title before uploading.` The storage name is derived, so do not test an empty derived value unless the fixture name is stripped to nothing.
8. `video metadata edit preserves storage`: upload, then select the row, change title, date, and duration, save, and assert the record changed while `storage.key` and `urls` are identical.
9. `video replace reuses the icon when no thumbnail is supplied`: upload, check `Replace video file`, choose a second MP4 with a different byte signature, leave the thumbnail input empty, save, assert the record id and icon key are unchanged and the media object bytes changed.
10. `video delete removes managed objects`: upload, delete through the row and confirm dialog, assert the record is gone and both sink HEADs return 404.
11. `legacy video delete stays database-only`: delete the seeded `media-video`, assert the record is gone and no error is shown. Restore the exact seeded record in `finally` with `writeDb`, because later tests and the next browser project both rely on it.
12. `album upload generates the zip and saves tracks`: select `01-fixture.mp3` and `02-fixture.mp3`, assert two derived rows and `Album zip will be generated`, accept the embedded cover, upload, find the album by title, and assert two `listing` ids, a cover URL, a generated zip URL, `storage.managed`, `storage.trackKeys` length 2, `storage.albumId` on both tracks, and that every track's `urls.icon` equals the album icon. Assert the sink has the cover, generated zip, and both tracks.
13. `album upload requires tracks`: no tracks, assert `Add at least one MP3 track.`
14. `album upload requires a cover when the track has none`: select `fixture-noart.mp3`, assert `Add a cover image.`
15. `album upload accepts a manual zip override`: choose `Use my own zip`, add `fixture.zip`, upload, and assert the stored zip bytes match the fixture.
16. `album folder uses the plus convention`: title `E2E Album`, assert the preview reads `Music/Albums/E2E+Album/` and the stored album and track URLs contain `E2E+Album`.
17. `album metadata edit changes titles and order without rewriting tracks`: change the album title, edit one track title, move a track up, save, and assert the album title, `listing` order, and track title changed while `storage.trackKeys` and track `urls` are unchanged.
18. `album delete cascades records and objects`: upload, delete through the row, assert the album and both track records are gone and the sink HEADs for cover, zip, and tracks return 404.
19. `cancel cleans up the batch and objects`: hold the first track PUT with a route gate, click Cancel, and assert the batch is removed and the sink has no asset for that key.
20. `retry finalize does not re-upload`: fail the finalize callable once at the network layer, assert the retry message, click Retry, and assert the record is created and the media PUT happened once.
21. `resume after reload completes the missing asset`: abort the second track PUT, reload the page, click Resume upload, unroute, and assert the album saves with both tracks.
22. `upload controls expose labels and live regions`: assert visible labels for the file, storage-name, thumbnail slider, folder, cover, and zip controls; `role="status"` on progress; `role="alert"` on errors.
23. `admin media cards keep the shared surface and action row`: update the existing layout test to the new controls, keeping the assertions on the surface class, flex end action row, and 36px button height.

Cleanup: every case is independent. Each mutation case uses a unique storage name or album folder derived from the test title plus a timestamp. Every created record is removed in `finally` with `deleteDb("media/<id>")`, and every created batch id is removed with `deleteDb("mediaUploads/<batchId>")` when discoverable from the record's `storage.batchId`. The sink reset runs once per browser project; unique names prevent cross-test collisions within one run.

Existing tests removed or rewritten:

- `video upload validates inline and keeps the entered values` is replaced by cases 6 and 7.
- `video upload clears the form only after the save succeeds` is replaced by case 4.
- `audio album upload validates inline instead of silently clearing` is replaced by cases 13 and 14.
- The audio and video auth redirect cases remain unchanged.
- The seeded media list assertion grows by one entry.

### Manual Verification

These require the real bucket and are not part of the automated gate:

- Upload a real MP4, confirm the CloudFront URL serves it and the thumbnail renders in the list.
- Upload a video over 100 MiB, drop the network mid-upload, and confirm Resume completes without re-sending completed parts.
- Replace the file with the same storage name, with and without a new thumbnail, and confirm the new bytes are served after invalidation.
- Upload a real album with embedded art, confirm the generated zip downloads and the album plays.
- Upload an album over 500 MB with a manual zip.
- Delete a managed video and album and confirm every object is gone from the bucket.
- Confirm a legacy record still plays and still deletes DB-only.
- Record the invalidation path count for one album create, replace, and delete; confirm it stays within the 1000-path monthly budget.

## Summary Of Changes

- [ ] Phase 0 is complete: five media secrets in both Firebase projects, the least-privilege IAM policy, the bucket CORS, the incomplete-multipart lifecycle rule, and both dev origins confirmed.
- [ ] `functions/src/media/config.ts` defines the secrets, base URL, caps, 15-minute ticket TTL, multipart thresholds, browser zip cap, sweep grace, and track limit.
- [ ] `functions/src/media/naming.ts` implements the exact video, audio folder, track filename, and URL rules, including rejection of `%`, `?`, `#`, and `&`.
- [ ] `functions/src/media/storage-adapter.ts` implements presign, multipart create and part presign, list and complete, abort, head, delete, and invalidate, with `signableHeaders` and batch metadata.
- [ ] `createMediaUpload` validates admin role, rate limit, names, sizes, content types, record and object duplicates, and replace preconditions; derives and freezes keys; starts multipart where needed; writes a batch.
- [ ] `resumeMediaUpload` mints single or multipart tickets for one asset, paginates parts, applies `If-None-Match` or `If-Match`, and advances `lastActivityAt`.
- [ ] `finalizeMediaUpload` claims the batch in a transaction, verifies every object and its batch metadata, completes multipart uploads, derives URLs, writes video or album plus tracks atomically with `storage.albumId`, is idempotent, and invalidates only on replace.
- [ ] `updateMediaMetadata` updates the allowed metadata, duration, track titles, and listing order, with shared validation.
- [ ] `deleteMedia` deletes and verifies objects first, then removes records, uses a deletion ledger for retries, cascades a track to its parent album, and supports the `{ batchId }` cancel path. Legacy records stay DB-only.
- [ ] `sweepMediaUploads` removes stale ticketed assets, aborts multipart uploads, completes pending deletions, and never touches objects outside a batch.
- [ ] The emulator media sink serves PUT, GET, HEAD, and Range with batch metadata and CORS, exposes an emulator-only reset, never uses multipart, and 404s in production.
- [ ] `database.rules.json` denies client access to `mediaUploads` and `mediaDeletions`, and indexes `media.fileName`, `media.folderName`, and `mediaUploads.lastActivityAt`.
- [ ] `functions/src/index.ts` exports the five callables, `sweepMediaUploads`, and the sink.
- [ ] `functions/package.json` adds the three AWS SDK packages; handlers import them dynamically; the Angular bundle gains no AWS dependency.
- [ ] The video admin tab drops the typed filename and id fields and gains a file input, derived title, date, storage name, provisional then authoritative path preview, thumbnail capture with labeled slider, override image, multipart and resume, cancel cleanup, retry finalize, replace with optional thumbnail, duration edit, and managed delete.
- [ ] The audio album admin tab drops the track textarea and gains title, derived folder, date, multi-file and folder selection with feature detection, ordered editable track rows, ID3 cover extraction with override, browser-generated zip under 500 MB with a manual fallback, track title and order edits, progress, cancel, retry, and managed delete.
- [ ] The dead `JsonService` media write path is removed.
- [ ] The explorer branches video playback inline: Drive URLs use the existing iframe, everything else uses a native video element with the thumbnail as poster.
- [ ] The seed writes the MP4, both ID3-tagged MP3s, the no-art MP3, the manual zip, seeds one S3-style video record, and resets the sink per browser project.
- [ ] All listed Functions vitest cases, Angular unit cases, and e2e cases pass, including replace, cancel, retry, and resume.
- [ ] `npm run e2e:gate` is green on Chromium, WebKit, and Firefox.
- [ ] The spec and the critique ledger pass their linters, and headings pass the case review.

## Verification Steps

Run, in order, from the repository root:

```bash
npm --prefix functions run build
npm --prefix functions test
CI=true npm test -- --watch=false
npm run e2e:gate
```

Then run the Markdown linter from the plugin checkout if it is installed. The rulebook's `scripts/lint-markdown.py` is not present in this installation, so the fallback is the manual check below. Validate the critique ledger with the redteam checker when available.

Confirm by hand:

- Every heading capitalizes each word.
- No em dash, en dash, arrow, or smart quote appears in the file.
- The five secret names match between the spec, `functions/src/media/config.ts`, and the secrets commands.
- The bucket CORS origins match the hosting origins.
- The key regexes in the spec match the naming module and the ticket validation.
- The limits in the spec match `functions/src/media/config.ts`: 15-minute tickets, 100 MiB multipart threshold, 8 MiB parts, 500 MB browser zip cap, 24-hour sweep grace.
- The five callables, the sweep, and the sink are the complete export set, with no sixth callable.

## Open Questions

None. The remaining unknowns are infrastructure values, not design choices: the bucket name, region, account id, and distribution id. They are captured as secrets and prerequisites.
