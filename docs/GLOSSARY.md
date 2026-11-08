# Glossary

Domain terms for LeCoursville. One bold term, a definition of what the concept is, and the rejected synonyms.

**Family**

A named group with a hex colour that people belong to through `Person.familyId`. It is the canonical term in UI, code, and database paths. _Avoid_: clan, group, tribe.

**Lineage**

The ancestry path text stored on a person plus the derived ancestry and descendant trees shown in the person modal. It is a separate concept from Family. _Avoid_: family tree, ancestry group.

**Clan**

Retired term for Family. It survives only in legacy code, the legacy `clans` database node, and historical specs during the migration window. Never use it in new code, copy, or schemas.

**Page title bar**

The white `app-page-toolbar` at the top of a page, carrying the page heading and page-level actions. Not the green application bar. _Avoid_: header, top nav.

**Theme**

The binary per-user visual mode, light or dark, stored as a string at `users/{uid}/prefs/theme`. Light is the default when nothing is stored. The OS setting is deliberately ignored. _Avoid_: dark mode setting, skin, appearance.

**Song**

A library entry: a title plus one plain-text body holding lyrics and optional Ultimate-Guitar-style chords, with optional source, key, and song leaders. _Avoid_: track, tune, hymn entry.

**Song Leader**

A person referenced by id on a song as someone known for leading it. Zero or more per song, never required. _Avoid_: singer, owner, author.

**Calendar Entry**

One printable line on a day cell in a generated calendar: either a birthday or an anniversary, with an optional age or lifespan suffix. _Avoid_: event, item, record.

**Lifespan Suffix**

The parenthesized birth and death years that replace the age suffix for a deceased person, for example `(1935-2015)`. It is the marker of death, not a decoration. _Avoid_: marker, dagger, ghost, grayscale.

**Calendar Page**

One printed landscape sheet for a single calendar month. A full year is twelve Calendar Pages. _Avoid_: sheet, slide, view.

**Primary Record**

A person record at `people/<id>` whose id does not end in `-S`. Virtual spouse records end in `-S` and are not Primary Records. _Avoid_: real person, base record.
