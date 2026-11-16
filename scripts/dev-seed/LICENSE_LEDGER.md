# Dev Seed License Ledger

Human-checked license record for every asset the dev seed writes (UI-008).

Sign-off status: PENDING HUMAN REVIEW before the first dev seed run.

Every asset below is public domain or a locally generated placeholder. The seed downloads at run time into a gitignored cache, verifies the Internet Archive checksum from item metadata, and deletes the cache when the run ends. The repository stores this ledger and the manifest, never the bulk assets.

The committed rows below name the catalogs. The plan mode resolves the actual files and prints a per-asset ledger with each source URL and identifier, marked pending human sign-off. Run `npm run seed:dev` and review that output before the first dev run. It is a human-run artifact and is never produced by the e2e gate.

## Asset Sources

| Class | Source | License | Attribution | Count |
|---|---|---|---|---|
| Videos | https://archive.org/details/prelinger | Public domain | Prelinger Archives, Internet Archive | 20 |
| Photos | https://www.loc.gov/photos/?q=national+park | Public domain | Library of Congress, Prints and Photographs Division | 9 |
| Audio | https://archive.org/details/great78 | Public domain | Great 78 Project, Internet Archive | 6 |

The manifest resolves these catalogs at seed time and verifies each Internet Archive file against the checksum published in its item metadata. The Library of Congress publishes no canonical checksum per derivative, so those images are not checksum-verified. The downloader records only their resolved digest in the generated per-asset ledger, and this gap stays open until a human reviews each Library of Congress source.

## Expressions

| Title | Attribution | Year | License |
|---|---|---|---|
| Give me liberty | Patrick Henry | 1775 | Public domain |
| Self-evident truths | Thomas Jefferson | 1776 | Public domain |
| Four score | Abraham Lincoln | 1863 | Public domain |
| To be or not to be | William Shakespeare | 1600 | Public domain |
| All the world is a stage | William Shakespeare | 1599 | Public domain |
| The best of times | Charles Dickens | 1859 | Public domain |
| Call me Ishmael | Herman Melville | 1851 | Public domain |
| I celebrate myself | Walt Whitman | 1855 | Public domain |
| Quiet desperation | Henry David Thoreau | 1854 | Public domain |
| Trust thyself | Ralph Waldo Emerson | 1841 | Public domain |
| Knowledge is power | Francis Bacon | 1597 | Public domain |
| No man is an island | John Donne | 1624 | Public domain |
| The unexamined life | Socrates, as recorded by Plato | c. 399 BC | Public domain |
| I think therefore I am | Rene Descartes | 1637 | Public domain |
| The pen and the sword | Edward Bulwer-Lytton | 1839 | Public domain |
| Brevity is the soul of wit | William Shakespeare | 1602 | Public domain |
| To err is human | Alexander Pope | 1711 | Public domain |
| A thing of beauty | John Keats | 1818 | Public domain |
| Water everywhere | Samuel Taylor Coleridge | 1798 | Public domain |
| Reports of my death | Mark Twain | 1897 | Public domain |

## Songs

| Title | Source | License |
|---|---|---|
| Amazing Grace | John Newton | Public domain |
| Come Thou Fount | Robinson | Public domain |
| Simple Gifts | Joseph Brackett | Public domain |
| Wayfaring Stranger | Traditional | Public domain |
| Be Thou My Vision | Traditional, translated by Mary Byrne | Public domain |

## E2E Pinned Fixture

| Fixture | Source | License | Attribution |
|---|---|---|---|
| fixture.mp4 | Generated locally by scripts/e2e/seed.mjs | Public domain placeholder | No external source, no copyright claim |

The pinned fixture keeps the Admin Media Upload spec offline and deterministic. It is separate from the bulk dev seed and is never fetched live.
