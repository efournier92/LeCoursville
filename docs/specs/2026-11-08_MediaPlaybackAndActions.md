# Media Playback And Actions

Spec for UI-020, UI-021, and UI-024. Workstream WS6. Depends on WS1 for action styling.

## Goal

User-facing videos actually play, an unplayable video says why, the Share and Download actions sit below the player right-aligned and compact on video and music, and the video drop zone reads the requested copy.

## Non-Goals

- No new media pipeline.
- No upload security change beyond the content type fix if one is needed.
- No redesign of the media explorer.

## Current State

- `MediaVideoComponent` wraps `MediaExplorerComponent` for video (`media-video.component.html:2-5`). The explorer uses a Drive iframe when the URL is a Drive URL, otherwise a native `<video controls preload="metadata">` (`media-explorer.component.html:45-68`).
- The Drive iframe sets the raw URL as src (`video-player-drive-iframe.component.ts:42-53`).
- Uploaded videos get an S3 or CloudFront URL (`functions/src/finalize-media-upload.ts:433-435`).
- The actions container sits above the player, centered, with a 120px minimum width (`media-explorer.component.html:12-37`, `media-explorer.component.scss:18-32`).
- A stale `.share-video-to-clipboard` absolutely-positioned style remains (`video-player-drive-iframe.component.scss:20-35`).
- The video drop-zone hint reads `Drop an MP4 here or choose a file.` (`admin-media-upload-video.component.html:21`).

## Behavior And Acceptance Criteria

### Playback

- Diagnose in order: the real `urls.download` shape, Drive `/preview` normalization, S3 content type and range support, emulator range support, codec, and an error handler.
- Drive `file/d/<id>/(view|edit)` and `docs.google.com/open?id=` normalize to `/preview`.
- The `<video>` element surfaces a real message on `error` instead of a silent black player.
- Uploaded objects serve `Content-Type: video/mp4` with range support.

### Actions

- The actions block renders after the player on video, audio, document, and photo album.
- It is right-aligned and compact. The 120px minimum width is removed. Download then Share, Share far right.
- On music the row sits below the player track list, never above the album art.
- Clipboard behavior and the tooltip are preserved. The no-selection state hides the row.
- Remove the stale absolute share style.

### UI-024 Copy

- The drop-zone hint reads `Drag/Drop an mp4 here, or click to select a file`.
- The block stays clickable through the hidden file input. Audio and photo drop-zone copy is checked for consistency and left alone unless it reads inconsistently.

## Data Model And Rollout

- No schema change. A content-type fix in the upload path applies to new uploads. Existing broken objects must be re-uploaded or re-headered by the operator.
- Roll back by branch revert.

## Light, Dark, And Print

- The error message and action row follow the palette in both modes.
- No print path.

## Accessibility

- The video error message is announced.
- Share and Download have accessible names and 44px targets.
- The Drive iframe keeps a title.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Video plays | `e2e/specs/media.spec.ts` | Selected video reaches `readyState >= 2` or emits `loadedmetadata` or `canplay` |
| Playback error | `e2e/specs/media.spec.ts` | A broken source shows the error message, not a blank player |
| Actions below player | `e2e/specs/media.spec.ts` | Share renders after the player and right-aligned on video |
| Music actions | `e2e/specs/media.spec.ts` | Share renders after the audio player and right-aligned |
| Drop-zone copy | `e2e/specs/admin-content.spec.ts` | Exact new hint text |

## Resolved Decisions And Open Questions

- Resolved: actions always render below the active panel, right-aligned.
- Open: if the S3 content type is wrong in production, a re-upload is an operator action outside this branch. Report it as a follow-up.
