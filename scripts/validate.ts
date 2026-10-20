/**
 * Validates every entry file before the site is allowed to build.
 *
 * The failure mode this project actually has is bad data, not bad code — a typo
 * in a coordinate, a photo that was never committed, a type that doesn't exist.
 * Catching those here means they fail loudly in CI instead of silently
 * producing a pin in the ocean.
 *
 * Run: npm run validate
 */
import { readdirSync, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { parse } from 'yaml'
import { EntrySchema } from '../src/data/schema.ts'
import { isLocalMedia } from '../src/data/schema.ts'
import { LOCATION_TYPE_KEYS } from '../src/data/locationTypes.ts'
import { isExternalMedia, mediaRepoPath } from '../src/data/media.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entriesDir = join(root, 'data', 'entries')
const publicDir = join(root, 'public')
const mediaDir = join(publicDir, 'media')

const errors: string[] = []
const warnings: string[] = []

const error = (file: string, message: string) => errors.push(`${file}: ${message}`)
const warn = (message: string) => warnings.push(message)

const files = readdirSync(entriesDir)
  .filter((name) => name.endsWith('.yaml') && !name.startsWith('_'))
  .sort()

if (files.length === 0) {
  console.error('No entry files found in data/entries/')
  process.exit(1)
}

const seenIds = new Map<string, string>()
const referencedFolders = new Set<string>()

for (const file of files) {
  const expectedId = file.replace(/\.yaml$/, '')
  let raw: unknown

  try {
    raw = parse(await readFile(join(entriesDir, file), 'utf8'))
  } catch (cause) {
    error(file, `is not valid YAML — ${(cause as Error).message}`)
    continue
  }

  const result = EntrySchema.safeParse(raw)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '(root)'
      error(file, `${path} ${issue.message}`)
    }
    continue
  }

  const entry = result.data

  // The ID/filename link is what connects an entry to its media folder. If it
  // drifts, media silently 404s — so this is an error, not a warning.
  if (entry.id !== expectedId) {
    error(file, `id is "${entry.id}" but the filename says "${expectedId}"`)
  }

  const duplicate = seenIds.get(entry.id)
  if (duplicate) error(file, `duplicate id, already used by ${duplicate}`)
  seenIds.set(entry.id, file)

  for (const item of entry.media ?? []) {
    if (!isLocalMedia(item) || isExternalMedia(item.file)) continue
    referencedFolders.add(entry.id)

    // Resolved the same way the app resolves it, so a file the site can render
    // is never reported missing, and vice versa.
    const relative = mediaRepoPath(entry.id, item.file)
    if (!existsSync(join(publicDir, relative))) {
      error(file, `media "${item.file}" not found at public/${relative}`)
    }
  }
}

// The CMS config repeats the type vocabulary, because Decap reads a YAML file
// and cannot import the TypeScript table. That duplication is the one thing
// that can silently drift, so it is checked rather than trusted: adding a type
// to locationTypes.ts and forgetting the CMS would otherwise leave a type you
// can author by hand but not from the browser.
const cmsConfigPath = join(root, 'public', 'admin', 'config.yml')
if (existsSync(cmsConfigPath)) {
  const cms = parse(await readFile(cmsConfigPath, 'utf8')) as {
    collections?: { name: string; fields?: { name: string; options?: { value: string }[] }[] }[]
  }
  const typeField = cms.collections
    ?.find((c) => c.name === 'entries')
    ?.fields?.find((f) => f.name === 'type')

  if (!typeField?.options) {
    warn('public/admin/config.yml has no entries.type options to check')
  } else {
    const inCms = typeField.options.map((o) => o.value)
    const missing = LOCATION_TYPE_KEYS.filter((t) => !inCms.includes(t))
    const extra = inCms.filter((t) => !(LOCATION_TYPE_KEYS as readonly string[]).includes(t))

    if (missing.length > 0) {
      error('public/admin/config.yml', `is missing type(s): ${missing.join(', ')}`)
    }
    if (extra.length > 0) {
      error('public/admin/config.yml', `has unknown type(s): ${extra.join(', ')}`)
    }
  }
}

// Orphaned media is a warning: files staged before the entry is written are a
// normal in-progress state, not a mistake.
if (existsSync(mediaDir)) {
  for (const folder of readdirSync(mediaDir)) {
    if (folder.startsWith('.') || !statSync(join(mediaDir, folder)).isDirectory()) continue
    if (!seenIds.has(folder)) {
      warn(`public/media/${folder}/ has no matching entry in data/entries/${folder}.yaml`)
    } else if (!referencedFolders.has(folder)) {
      warn(`public/media/${folder}/ exists but ${folder}.yaml doesn't reference any files from it`)
    }
  }
}

for (const message of warnings) console.warn(`  warning  ${message}`)

if (errors.length > 0) {
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found:\n`)
  for (const message of errors) console.error(`  error  ${message}`)
  console.error('')
  process.exit(1)
}

console.log(
  `${files.length} entr${files.length === 1 ? 'y' : 'ies'} valid` +
    (warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''),
)
