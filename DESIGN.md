# History Map — Design

A personal, map-first travel journal. Pins on a world map; click a pin, read what I
thought of the place, see the photos. Entries are hand-authored files in this repo —
no CMS, no database, no backend.

Status: **design only**. Nothing is built yet.

---

## 1. Goals and non-goals

**Goals**

- A world map, full-bleed, with a pin per saved place.
- Clicking a pin shows that entry: date, type, description, my opinion, photos/video.
- Entries live in this repo as plain text files I edit by hand.
- Media is associated with an entry by entry ID, not by a hand-maintained path.
- Deploys automatically on `git push`, reachable at a public URL.
- Mobile-friendly (phase 3, but the layout is designed for it from the start).

**Non-goals (for now)**

- No admin UI, no login, no write path from the browser.
- No server, no database, no API keys, no per-request billing.
- No user accounts, comments, or sharing features.

**Design constraint that drives most decisions:** the site is fully static. Everything
is resolved at build time into HTML/JS/JSON and served from a CDN. That is what makes
it free, fast, and essentially unbreakable.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **React + TypeScript, built with Vite** | You know React. Vite's dev server is instant and its static build is exactly what a Pages host wants. TS pays for itself here because the entry schema is the whole app. |
| Map | **Leaflet**, via **react-leaflet** | Mature, small, no API key, no account, no billing. Touch/pinch works out of the box. |
| Basemap tiles | **CARTO Positron** (light) / **Dark Matter** (dark), OSM data | Free for low-volume personal use with attribution, and visually quiet — muted greys let colored pins carry the visual weight. Swappable in one line. |
| Clustering | **react-leaflet-cluster** | Needed the moment you have >30 pins in one city. |
| Data format | **YAML, one file per entry** | Comfortable for multi-line prose (descriptions, opinions) in a way JSON is not. One file per entry means adding an entry is a new file, never a merge conflict. |
| Validation | **Zod** schema + a `npm run validate` script | A typo in a lat/lon or a missing photo fails the build with a clear message, instead of silently producing a broken pin. |
| Hosting | **GitHub Pages** via GitHub Actions | Free, push-to-deploy, zero config beyond one workflow file. |

**Rejected alternatives, and why** — so these don't get relitigated later:

- *MapLibre GL + vector tiles* — better looking, smoother zoom, but essentially every
  good vector tile source wants an account and an API key, and keys can't be kept
  secret in a static site. Revisit only if the raster basemap starts feeling dated.
- *Google Maps* — requires a billing-enabled API key. Overkill and a liability for a
  personal journal.
- *Next.js / Astro* — nothing here needs SSR, routing, or islands. Vite + React is
  strictly less machinery for the same result.
- *A single `entries.yaml` file* — simpler to eyeball, but it gets unwieldy past ~50
  entries and every edit touches the same file. The per-file layout costs nothing
  because the build concatenates them anyway.

### Node

**Installed:** Node 24.19.0 (LTS) at `~/.local/node`, from the official nodejs.org
tarball with its SHA256 verified against the published manifest. There's no Homebrew
on this machine, so it was extracted into the home directory rather than installed
system-wide — no `sudo`, and nothing outside `~/.local`. `~/.zshrc` puts it on `PATH`.

To remove it later: delete `~/.local/node` and the two `PATH` lines from `~/.zshrc`.

Node 24 runs TypeScript directly, so `scripts/*.ts` need no `tsx` or `ts-node`.

---

## 3. Repository layout

```
history_map/
├─ data/
│  └─ entries/
│     ├─ lisbon-miradouro-santa-catarina.yaml
│     ├─ oaxaca-mercado-20-de-noviembre.yaml
│     └─ ...                      # one file per entry, filename == entry ID
├─ public/
│  └─ media/
│     ├─ lisbon-miradouro-santa-catarina/
│     │  ├─ 01-sunset.jpg
│     │  └─ 02-terrace.jpg
│     └─ oaxaca-mercado-20-de-noviembre/
│        └─ 01-grill.jpg
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ data/
│  │  ├─ schema.ts               # Zod schema + inferred TS types
│  │  └─ loadEntries.ts          # glob-imports data/entries/*.yaml, parses, sorts
│  ├─ components/
│  │  ├─ MapView.tsx
│  │  ├─ EntryPin.tsx
│  │  ├─ EntryPanel.tsx          # sidebar on desktop, bottom sheet on mobile
│  │  ├─ MediaGallery.tsx
│  │  └─ FilterBar.tsx
│  ├─ hooks/
│  │  ├─ useSelectedEntry.ts     # selection <-> URL query param
│  │  └─ useFilters.ts
│  └─ styles/
├─ scripts/
│  └─ validate.ts                # runs the schema over every file + checks media
├─ .github/workflows/deploy.yml
├─ vite.config.ts
├─ DESIGN.md                     # this file
└─ README.md                     # how to add an entry, how to run it
```

The key structural idea: **`data/` and `public/media/` are the "database."** `src/` is
disposable — it could be rewritten in a different framework without touching a single
entry.

---

## 4. Data model

One YAML file per entry. **The filename (minus `.yaml`) is the entry ID**, and it must
equal the `id` field inside. Validation enforces this, so the ID can never drift from
the media folder it points at.

### ID convention

Lowercase kebab-case, `place-thing`, stable forever:
`lisbon-miradouro-santa-catarina`, `oaxaca-mercado-20-de-noviembre`.

Human-readable rather than a UUID, because you'll be typing these into folder names by
hand. Don't put the date in the ID — you may return to the same place.

### Full example

```yaml
id: lisbon-miradouro-santa-catarina
title: Miradouro de Santa Catarina
coordinates:
  lat: 38.7089
  lon: -9.1487
date: 2024-06-14          # ISO 8601. The date of the visit, not of writing.
type: viewpoint           # one of the controlled list below
place:
  city: Lisbon
  country: Portugal
  country_code: PT        # ISO 3166-1 alpha-2, used for flag + grouping

description: >
  A wide stone terrace above the Tagus, west of Bairro Alto. Kiosk sells
  beer, everyone else brings their own. Buskers most evenings.

opinion: >
  The single best sunset in the city and it costs nothing. Arrive 45 minutes
  early or you're standing. Skip the kiosk — the queue is the whole show.

rating: 4                 # optional, 1–5
tags: [sunset, free, crowded]

media:
  - file: 01-sunset.jpg
    caption: Looking west, about 20 minutes before sunset.
  - file: 02-terrace.jpg
    caption: The terrace, filling up.
  - youtube: dQw4w9WgXcQ  # external video, see §5
    caption: Buskers, June 2024.

links:
  - label: OpenStreetMap
    url: https://www.openstreetmap.org/node/123456
```

### Field reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | slug | Must match filename. Immutable once media exists. |
| `title` | yes | string | Display name on the pin popup and panel header. |
| `coordinates.lat` | yes | number | −90…90 |
| `coordinates.lon` | yes | number | −180…180 |
| `date` | yes | `YYYY-MM-DD` | Also accepts `YYYY-MM` for fuzzy memory. |
| `type` | yes | enum | Drives pin color + icon. See below. |
| `description` | yes | string | What the place *is*. Factual. |
| `opinion` | no | string | What *you* thought. This is the point of the site. |
| `place.city` | no | string | |
| `place.country` | no | string | |
| `place.country_code` | no | ISO-3166-1 α2 | Enables "17 countries" style stats later. |
| `rating` | no | 1–5 int | |
| `tags` | no | string[] | Free-form, lowercase. Becomes a filter later. |
| `media` | no | list | See §5. First item is the cover image. |
| `links` | no | list of `{label,url}` | |

Everything optional is genuinely optional — an entry with only the required six fields
renders correctly. That matters, because the friction of adding an entry determines
whether you actually keep this thing up.

### Location types (controlled vocabulary)

`food` · `drink` · `lodging` · `viewpoint` · `nature` · `hike` · `beach` ·
`museum` · `landmark` · `neighborhood` · `shop` · `event` · `other`

Each maps to a color and a small icon in one central `TYPES` table. Adding a type is a
two-line change. Validation rejects unknown types — that's deliberate, so the legend
stays meaningful instead of accumulating one-off values.

---

## 5. Media

**Convention over configuration:** media for entry `X` lives in `public/media/X/`. The
YAML lists only filenames. The app resolves `public/media/{id}/{file}` at render time.
Rename an entry ID and you must rename the folder — validation will tell you.

- **Images**: `.jpg` / `.webp` / `.png`. Name them `01-`, `02-` so ordering is obvious
  in Finder; the YAML order is what actually controls display order.
- **Video**: two options.
  - *Small clips* (< ~10 MB, a few seconds): commit as `.mp4`, played inline.
  - *Anything longer*: upload to YouTube/Vimeo as unlisted and reference it as
    `youtube: <id>` / `vimeo: <id>`. Rendered as a click-to-load thumbnail so the page
    stays fast and no third-party script loads until you ask for it.

**Why the split:** GitHub caps individual files at 100 MB and a Pages site at ~1 GB,
and — more importantly — git stores every version of a binary forever. A few hundred
MB of phone video committed once will bloat the clone permanently. Photos are fine;
raw video is not.

**Before committing photos**, resize to ~1600px on the long edge and strip EXIF. A
`npm run media:optimize` script (sharp) can do this in one pass over
`public/media/`. EXIF stripping matters — phone photos carry GPS coordinates and
timestamps that are more precise than what you're deliberately publishing.

---

## 6. Application architecture

### Data flow

```
data/entries/*.yaml
      │  import.meta.glob(..., { eager: true })   ← Vite inlines all of it at build time
      ▼
   parse + Zod validate  ──►  Entry[]  (sorted by date desc)
      ▼
   App state:  entries, filters, selectedId
      ├──► MapView      renders one Marker per filtered entry
      └──► EntryPanel   renders the selected entry
```

There is no fetch, no loading state, no error state. The entries are part of the
JS bundle. At a few hundred entries with prose that is comfortably under 200 KB
gzipped; if it ever isn't, the fix is to emit a separate `entries.json` and fetch it,
which is a contained change behind `loadEntries.ts`.

### State

Three pieces, all in `App`, no state library needed:

- `selectedId: string | null` — mirrored to the URL as `?entry=<id>`, so any pin is a
  shareable link and the back button closes the panel.
- `filters: { types: Set<Type>, years: [number, number] | null, query: string }`
- Map viewport — owned by Leaflet; we only push to it (fly to a selected pin).

### Interaction model

- **Click a pin** → select it, panel opens, map eases the pin into the visible area
  (offset so it isn't hidden behind the panel or sheet).
- **Click the map background** or press `Esc` → deselect.
- **Cluster click** → zoom to that cluster's bounds.
- **Deep link** `?entry=lisbon-...` → on load, select it and fly there.
- **No entry selected** → map fits the bounds of all filtered entries.

---

## 7. Layout

**Desktop (≥ 1024px)** — map fills the viewport; a 420px panel slides in from the
right when a pin is selected. Filter chips float top-left over the map; legend
bottom-left.

```
┌──────────────────────────────────────┬───────────────┐
│ [food][drink][nature] ×              │  ▣ photo      │
│                                      │  Miradouro…   │
│            ●         ●               │  Lisbon · PT  │
│                 ●                    │  14 Jun 2024  │
│        ●                             │  ─────────    │
│                    ●                 │  description  │
│                                      │  opinion      │
│ legend                    © CARTO/OSM│               │
└──────────────────────────────────────┴───────────────┘
```

**Mobile (< 768px)** — map fills the screen. Selecting a pin raises a bottom sheet to
~45% height showing cover photo, title, date and the first lines of the opinion; drag
up (or tap) to expand to full height. The map pans so the selected pin sits in the
upper half. Filters collapse into a single button that opens a full-screen sheet.

Breakpoints handled with CSS only where possible; one `useMediaQuery` decides
sidebar-vs-sheet since the interaction differs, not just the styling.

---

## 8. Deployment

**Decided: public repo, GitHub Pages + Actions, default subdomain.**

Push to `main` → workflow runs `npm ci`, `npm run validate`, `npm run build`, uploads
`dist/`, deploys. Live in ~60 seconds at `https://<username>.github.io/history_map/`.

Because it's a *project* Pages site served from a subpath, `vite.config.ts` sets
`base: '/history_map/'`. Every media URL is built from that, so media paths must go
through a single `mediaUrl(id, file)` helper that prepends `import.meta.env.BASE_URL`
— never hardcoded. That way, pointing a custom domain at it later is a one-line change
to `base` rather than a find-and-replace.

*(Considered and set aside: Cloudflare Pages, which builds private repos on the free
tier. Only relevant if the repo ever needs to go private.)*

**Phase 0 is to deploy an almost-empty site with three sample entries**, before
building any real UI. It proves the whole pipeline end-to-end while there's nothing to
debug, and everything after that is just editing a working thing.

---

## 9. Authoring workflow

The thing to optimize. Adding an entry should be:

1. `cp data/entries/_template.yaml data/entries/my-new-place.yaml`
2. Fill it in. Get coordinates by right-clicking in Google Maps → click the lat/lon to
   copy.
3. `mkdir public/media/my-new-place` and drop photos in.
4. `npm run validate` — catches typos, bad coordinates, unknown types, media
   referenced but missing, media present but unreferenced.
5. `git add . && git commit && git push`. Live in a minute.

**`npm run new-entry` is in scope.** It prompts for title, coordinates, type and
place, then writes both the YAML file (with a generated ID and the optional fields
present but commented out) and the empty media folder. This collapses steps 1–3 into
one command, and it's the difference between an entry taking 30 seconds and taking
five minutes.

---

## 10. Validation and CI

`scripts/validate.ts` runs in CI *before* the build, so a bad entry fails loudly
instead of shipping:

- Every file parses as YAML and matches the Zod schema.
- `id` equals the filename; all IDs unique.
- Latitude in −90…90, longitude in −180…180, and *not* `0,0` (the classic sign of a
  missing coordinate).
- `date` is a real date, not in the future.
- `type` is in the vocabulary.
- Every `media[].file` exists on disk under `public/media/<id>/`.
- Every folder in `public/media/` has a matching entry (warning, not error).

Plus `tsc --noEmit` and Prettier. No test framework initially — there's very little
logic to unit-test, and the validator covers the failure mode that actually occurs
(bad data, not bad code).

---

## 11. Privacy

**The repo is public.** Two consequences to keep in mind while authoring:

- **Everything committed is published immediately.** There is no draft state — a
  half-written entry pushed to `main` is live and readable both on the site and in the
  repo. Keep work-in-progress on a branch until it's ready. (If this becomes annoying,
  a `draft: true` field that the production build filters out is a ~10-line addition.)
- **A public map of where you've been, with dates, is a movement history.** Fine for
  restaurants and viewpoints. Think twice before pinning your apartment or a friend's
  house — and if you do, round the coordinates by hand. (A `precision: coarse` flag
  that rounds to ~1 km was considered and deferred; easy to add later.)
- **Strip EXIF from photos** (§5). Otherwise the *photo* leaks exact coordinates and
  timestamps even when the entry itself is vague. This is the one that catches people
  out, because it's invisible.

---

## 12. Build order

| Phase | Deliverable | Why this order |
|---|---|---|
| **0** | Repo scaffolded, 3 sample entries, validator, deployed and live | Proves the pipeline while there's nothing to debug |
| **1** | Map + pins + click-to-open panel + images + `new-entry` | The actual product; usable at this point |
| **2** | Clustering, type filters, search, deep links, legend | Only matters once there are enough entries to need it |
| **3** | Mobile bottom sheet, image optimization, dark mode | Polish |
| **4** | Optional: stats (countries/year), timeline scrub, GPX traces, PWA offline | Nice-to-haves, none of them block anything |

---

## 13. Decisions

**Settled:**

| Decision | Choice |
|---|---|
| Repo visibility | **Public** |
| Host | **GitHub Pages** via Actions |
| URL | **`<username>.github.io/history_map/`** — so `base: '/history_map/'` |
| Draft state | **No** — use branches for work-in-progress |
| Coordinate fuzzing | **No** — round by hand if ever needed |
| Entry scaffolding | **Yes** — `npm run new-entry` |

| Node | **Installed** — 24.19.0 LTS in `~/.local/node` |
| Dropbox | **`.dropboxignore`** for `node_modules`, `dist`, `.git`, `.vite` |

The Dropbox exclusion was written before the first `npm install`, so those directories
never synced. The same paths also carry the `com.dropbox.ignored` extended attribute,
which is the mechanism the desktop client honours directly — belt and braces, since
silent `.git` corruption is expensive and the fix is free.

**One consequence:** `.git/` is no longer backed up by Dropbox. Until you push to
GitHub, this repo's history exists in exactly one place.

**Still open:**

1. **Nothing blocking.** Push to GitHub and enable Pages — see §8 and the README.
