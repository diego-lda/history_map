/**
 * Media lives at public/media/<entry-id>/<file>, so an entry's YAML only ever
 * names the file — the entry ID supplies the folder.
 *
 * Everything goes through here rather than hardcoding paths, because the site is
 * served from a subpath (/history_map/) and moving to a custom domain must stay a
 * one-line change in vite.config.ts.
 */
/** True for a value that points somewhere other than this repo. */
export const isExternalMedia = (file: string) => /^https?:\/\//.test(file)

/**
 * Where a stored media value lives inside `public/`, e.g. `media/<id>/x.jpg`.
 *
 * Two shapes reach us. Hand-authored entries store a bare filename and let the
 * entry ID supply the folder. Decap stores a site-absolute path, because the
 * CMS needs something it can preview — and that path includes the base the site
 * is served from. Normalising from `/media/` onwards drops that base, so stored
 * paths survive a change to `base` in vite.config.ts.
 *
 * The app and scripts/validate.ts both resolve through here; they disagreed
 * once, and the result was a build that failed on a file that was present.
 */
export function mediaRepoPath(entryId: string, file: string): string {
  if (file.startsWith('/') || file.includes('/media/')) {
    const at = file.indexOf('/media/')
    return at >= 0 ? file.slice(at + 1) : file.replace(/^\/+/, '')
  }
  return `media/${entryId}/${file}`
}

export function mediaUrl(entryId: string, file: string): string {
  if (isExternalMedia(file)) return file
  return `${import.meta.env.BASE_URL}${mediaRepoPath(entryId, file)}`
}

/** Extensions we render with <video> rather than <img>. */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov']

export function isVideoFile(file: string): boolean {
  return VIDEO_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
}
