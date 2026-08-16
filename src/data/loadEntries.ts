import { parse } from 'yaml'
import { EntrySchema, fullDate, type Entry } from './schema.ts'

/**
 * Every entry file, inlined into the bundle at build time. There is no fetch and
 * no loading state — the data *is* the app.
 *
 * If this ever gets big enough to hurt first paint (a few hundred entries with
 * prose is still well under 200KB gzipped), the fix is to emit a separate
 * entries.json and fetch it. That change is contained entirely to this file.
 */
const files = import.meta.glob('../../data/entries/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function idFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.yaml$/, '')
}

export function loadEntries(): Entry[] {
  const entries: Entry[] = []

  for (const [path, raw] of Object.entries(files)) {
    const id = idFromPath(path)
    if (id.startsWith('_')) continue // _template.yaml and friends

    const result = EntrySchema.safeParse(parse(raw))
    if (!result.success) {
      // npm run validate turns this into a build failure with a readable
      // message. Here we skip the entry so one bad file can't blank the map.
      console.error(`Invalid entry ${id}:`, result.error.issues)
      continue
    }
    entries.push(result.data)
  }

  return entries.sort((a, b) => fullDate(b.date).localeCompare(fullDate(a.date)))
}
