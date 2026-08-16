/**
 * Scaffolds a new entry: one YAML file, one media folder, correct ID in both.
 *
 * The friction of adding an entry is what decides whether this site stays up to
 * date, so this exists to make it a single command.
 *
 * Run: npm run new-entry
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { LOCATION_TYPE_KEYS } from '../src/data/locationTypes.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rl = createInterface({ input: stdin, output: stdout })

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents, so "\u014cwakudani" slugs cleanly
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Ctrl-D — or a piped stdin running out of lines — closes the interface while a
 * question is still pending, and that promise then never settles. Racing against
 * 'close' turns a silent hang into a clean exit.
 */
const CANCELLED = 'cancelled'
const cancellation = new Promise<never>((_, reject) => {
  rl.once('close', () => reject(new Error(CANCELLED)))
})

async function ask(question: string, fallback = ''): Promise<string> {
  const prompt = fallback ? `${question} [${fallback}] ` : `${question} `
  const answer = (await Promise.race([rl.question(prompt), cancellation])).trim()
  return answer || fallback
}

/** Accepts "38.7089, -9.1487" pasted straight out of Google Maps. */
async function askCoordinates(): Promise<{ lat: number; lon: number }> {
  for (;;) {
    const raw = await ask('Coordinates (paste "lat, lon" from Google Maps):')
    const match = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (match) {
      const lat = Number(match[1])
      const lon = Number(match[2])
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon }
      console.log('  Out of range — latitude is -90..90, longitude is -180..180.')
    } else {
      console.log('  Expected something like: 38.7089, -9.1487')
    }
  }
}

async function askType(): Promise<string> {
  console.log(`  Types: ${LOCATION_TYPE_KEYS.join(' · ')}`)
  for (;;) {
    const type = (await ask('Type:', 'other')).toLowerCase()
    if ((LOCATION_TYPE_KEYS as readonly string[]).includes(type)) return type
    console.log(`  "${type}" isn't in the list.`)
  }
}

async function main() {
  const title = await ask('Title (the name of the place):')
  if (!title) {
    console.error('A title is required.')
    return 1
  }

  const id = await ask('Entry ID:', slugify(title))
  const entryPath = join(root, 'data', 'entries', `${id}.yaml`)
  if (existsSync(entryPath)) {
    console.error(`data/entries/${id}.yaml already exists.`)
    return 1
  }

  const { lat, lon } = await askCoordinates()
  const type = await askType()
  const date = await ask('Date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10))
  const city = await ask('City (optional):')
  const country = await ask('Country (optional):')
  const countryCode = country
    ? (await ask('Country code (ISO alpha-2, optional):')).toUpperCase()
    : ''

  const yaml = `id: ${id}
title: ${title}

coordinates:
  lat: ${lat}
  lon: ${lon}

date: ${date}
type: ${type}

description: >
  TODO: what this place is.

opinion: >
  TODO: what you thought of it.
${
  city || country
    ? `
place:
${city ? `  city: ${city}\n` : ''}${country ? `  country: ${country}\n` : ''}${countryCode ? `  country_code: ${countryCode}\n` : ''}`
    : ''
}
# rating: 3
# tags: []

# Drop photos in public/media/${id}/ and list them here by filename.
media: []
#  - file: 01-photo.jpg
#    caption:
`

  writeFileSync(entryPath, yaml)
  mkdirSync(join(root, 'public', 'media', id), { recursive: true })

  console.log(`
Created:
  data/entries/${id}.yaml
  public/media/${id}/

Next:
  1. Fill in the description and opinion.
  2. Drop photos into public/media/${id}/ and list them under media:.
  3. npm run validate
`)

  return 0
}

try {
  process.exitCode = await main()
} catch (error) {
  if ((error as Error).message === CANCELLED) {
    console.error('\nCancelled — nothing was written.')
    process.exitCode = 1
  } else {
    throw error
  }
} finally {
  rl.close()
}
