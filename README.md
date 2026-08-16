# History Map

A map of places I've been and what I thought of them. Entries are YAML files in
this repo; there's no database and no backend. Push to `main` and it deploys.

See [DESIGN.md](DESIGN.md) for why it's built the way it is.

## Running it

```bash
npm install
npm run dev
```

## Adding an entry

```bash
npm run new-entry
```

It asks for a title, coordinates (paste `38.7089, -9.1487` straight from Google
Maps — right-click the spot, then click the numbers to copy), type, date and
place. It writes `data/entries/<id>.yaml` and creates `public/media/<id>/`.

Then:

1. Fill in `description` (what the place is) and `opinion` (what you thought).
2. Drop photos into `public/media/<id>/` and list them under `media:` by
   filename — the folder is found from the entry ID, so you never write a path.
3. `npm run validate`
4. Commit and push. Live in about a minute.

`data/entries/_template.yaml` documents every field if you'd rather copy a file
by hand.

### Before committing photos

Resize to roughly 1600px on the long edge and **strip EXIF** — phone photos
carry GPS coordinates and timestamps, which will publish an exact location even
when the entry itself is deliberately vague.

Don't commit raw video. Git keeps every version of a binary forever and GitHub
caps files at 100MB. Short clips (a few seconds, under ~10MB) are fine as
`.mp4`; anything longer goes to YouTube as unlisted and gets referenced by ID:

```yaml
media:
  - youtube: dQw4w9WgXcQ
    caption: Buskers, June 2024.
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run new-entry` | Scaffold a new entry + its media folder |
| `npm run validate` | Check every entry against the schema and confirm its media exists |
| `npm run build` | validate → typecheck → production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which validates,
builds and publishes to GitHub Pages.

One-time setup on the repo: **Settings → Pages → Source → GitHub Actions**.

The site is served from `https://<username>.github.io/history_map/`, which is
why `vite.config.ts` sets `base: '/history_map/'`. If you move to a custom
domain, change that to `'/'` — nothing else, because media URLs are built from
`import.meta.env.BASE_URL` in `src/data/media.ts`.

## Layout

```
data/entries/     one YAML file per entry; the filename IS the entry ID
public/media/     one folder per entry ID, holding that entry's photos
src/              the app — disposable; the data above is the real content
scripts/          validate.ts and new-entry.ts
```

## A note on privacy

This repo is public, so everything committed is published the moment it's
pushed — there's no draft state. Keep work-in-progress on a branch. And think
before pinning somewhere residential; a dated map of where you've been is a
movement history.
