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
