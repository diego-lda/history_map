/**
 * Media lives at public/media/<entry-id>/<file>, so an entry's YAML only ever
 * names the file — the entry ID supplies the folder.
 *
 * Everything goes through here rather than hardcoding paths, because the site is
 * served from a subpath (/history_map/) and moving to a custom domain must stay a
 * one-line change in vite.config.ts.
 */
export function mediaUrl(entryId: string, file: string): string {
  return `${import.meta.env.BASE_URL}media/${entryId}/${file}`
}

/** Extensions we render with <video> rather than <img>. */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov']

export function isVideoFile(file: string): boolean {
  return VIDEO_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
}
