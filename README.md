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

`data/entry-template.yaml` documents every field if you'd rather copy a file
by hand.

### Photos

Both authoring paths cap photos at 1600px on the long edge:

- the dev form resizes on upload, and re-encoding strips EXIF (including GPS)
- the CMS commits uploads untouched, so CI resizes them on push and commits the
  result back

`npm run media:optimize` does the same locally; add `-- --check` to report
without changing anything.

**One gap worth knowing:** a photo already under 1600px is left alone, so it
keeps its EXIF. If it came straight off a phone via the CMS, that includes GPS
coordinates — in a public repo.

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

## Adding an entry from the browser (local only)

`npm run dev` renders an **+ Add entry** button. It writes
`data/entries/<id>.yaml` and `public/media/<id>/` straight into the repo, with
up to five photos — resized to 1600px and re-encoded, which strips EXIF
(including GPS). Review the result, then commit and push as usual.

The form exists only in development. The deployed site is static and has no
write path, so the button and its endpoint are absent from the production build.

## Adding an entry from a browser (anywhere)

`https://diego-lda.github.io/history_map/admin/` is a Decap CMS editor. Sign in
with GitHub and each save is an ordinary commit — `data/entries/<id>.yaml` plus
photos in `public/media/<id>/` — which triggers the usual deploy.

It needs a one-time OAuth proxy; see
[tools/decap-oauth-worker/README.md](tools/decap-oauth-worker/README.md).

### Trying the CMS locally, without any of that

```bash
npm run cms   # in one terminal
npm run dev   # in another
```

Then open http://localhost:5173/history_map/admin/. `local_backend: true` makes
the CMS write to your working copy instead of GitHub, so you can see exactly
what it produces before wiring up OAuth.

### Which tool to use

| | Best for |
|---|---|
| `+ Add entry` (dev form) | At your laptop. Fastest, strips EXIF, accepts decimal commas. |
| `/admin/` (Decap) | Away from your laptop, phone included. Commits straight to GitHub. |
| Editing YAML by hand | Fixing or rewording an existing entry. |
