import type { Plugin } from 'vite'
import type { IncomingMessage } from 'node:http'
import { existsSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'
import { Scalar } from 'yaml'
import { EntrySchema } from '../src/data/schema.ts'

/**
 * Dev-only server behaviour: the write path for the "Add entry" form, plus a
 * rewrite so /admin/ reaches the CMS page the way a static host would.
 *
 * The published site is static and has no backend, so this endpoint exists only
 * under `npm run dev`. It writes the same files you would otherwise create by
 * hand — data/entries/<id>.yaml and public/media/<id>/ — so the form is a
 * shortcut for authoring, never a runtime dependency of the site.
 */

const MAX_BODY_BYTES = 60 * 1024 * 1024 // 5 phone photos, base64-inflated
const MAX_PHOTOS = 5
const LONG_EDGE = 1600

type IncomingMedia = { name: string; caption?: string; alt?: string; dataUrl: string }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Upload too large — keep photos under about 10MB each.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * Downscale and re-encode through `sips`, which also drops EXIF — phone photos
 * carry GPS and timestamps, and this repo is public. If sips isn't available
 * (non-macOS) the original is kept and the caller is told.
 */
function normalisePhoto(rawPath: string, finalPath: string): boolean {
  try {
    // `sips -Z` scales in both directions, so passing a flat 1600 would enlarge
    // anything smaller — blurring it and inflating the repo for no gain. Cap the
    // target at the photo's own long edge so this only ever shrinks.
    const probe = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', rawPath], {
      encoding: 'utf8',
    })
    const width = Number(probe.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0)
    const height = Number(probe.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0)
    const longEdge = Math.max(width, height)
    const target = longEdge > 0 ? Math.min(LONG_EDGE, longEdge) : LONG_EDGE

    // Re-encoding is what drops EXIF, so this runs even when no resize is needed.
    execFileSync('sips', ['-Z', String(target), rawPath, '--out', finalPath], {
      stdio: 'ignore',
    })
    rmSync(rawPath, { force: true })
    return true
  } catch {
    renameSync(rawPath, finalPath)
    return false
  }
}

function buildYaml(entry: Record<string, unknown>): string {
  const doc = new YAML.Document(entry)
  // Prose reads far better as block scalars than as one long quoted line.
  for (const key of ['description', 'opinion']) {
    const node = doc.get(key, true) as Scalar | undefined
    if (node && typeof node.value === 'string') node.type = Scalar.BLOCK_FOLDED
  }
  return doc.toString({ lineWidth: 80 })
}


export function entryWriter(): Plugin {
  const root = resolve(import.meta.dirname, '..')

  return {
    name: 'history-map-entry-writer',
    apply: 'serve', // never part of a production build


    configureServer(server) {
      // A static host resolves /admin/ to /admin/index.html; Vite's dev server
      // hands directory requests to the SPA fallback instead, so the CMS URL
      // silently renders the map. Rewrite it so the same URL works in both.
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          const [path, query = ''] = req.url.split('?')
          if (/\/admin\/?$/.test(path)) {
            req.url = `${path.replace(/\/?$/, '')}/index.html${query ? `?${query}` : ''}`
          }
        }
        next()
      })

      server.middlewares.use('/__add-entry', async (req, res) => {
        const send = (status: number, payload: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        }

        if (req.method !== 'POST') return send(405, { error: 'POST only' })

        try {
          const body = JSON.parse(await readBody(req))
          const media: IncomingMedia[] = Array.isArray(body.media) ? body.media : []

          if (media.length > MAX_PHOTOS) {
            return send(400, { error: `At most ${MAX_PHOTOS} photos per entry.` })
          }

          const id = String(body.entry?.id ?? '')
          if (!SLUG.test(id)) {
            return send(400, { error: 'Entry ID must be lowercase kebab-case.' })
          }

          const entryPath = join(root, 'data', 'entries', `${id}.yaml`)
          if (existsSync(entryPath)) {
            return send(409, { error: `data/entries/${id}.yaml already exists.` })
          }

          // Name the files before validating, so the schema sees real filenames.
          const mediaDir = join(root, 'public', 'media', id)
          const named = media.map((item, index) => {
            const dot = item.name.lastIndexOf('.')
            const stem = dot > 0 ? item.name.slice(0, dot) : item.name
            const ext = (dot > 0 ? item.name.slice(dot + 1) : 'jpg').toLowerCase()
            const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg'
            const safeStem = slugify(stem).slice(0, 40) || 'photo'
            return {
              ...item,
              filename: `${String(index + 1).padStart(2, '0')}-${safeStem}.${safeExt}`,
            }
          })

          const entry = {
            ...body.entry,
            ...(named.length > 0
              ? {
                  media: named.map((m) => ({
                    file: m.filename,
                    ...(m.caption ? { caption: m.caption } : {}),
                    ...(m.alt ? { alt: m.alt } : {}),
                  })),
                }
              : {}),
          }

          // The same schema the validator and the app use — a form submission
          // can't produce an entry that `npm run validate` would reject.
          const parsed = EntrySchema.safeParse(entry)
          if (!parsed.success) {
            return send(400, {
              error: 'Validation failed',
              issues: parsed.error.issues.map((i) => ({
                path: i.path.join('.') || '(root)',
                message: i.message,
              })),
            })
          }

          mkdirSync(mediaDir, { recursive: true })

          let stripped = true
          for (const item of named) {
            const base64 = item.dataUrl.slice(item.dataUrl.indexOf(',') + 1)
            const rawPath = join(mediaDir, `.raw-${item.filename}`)
            writeFileSync(rawPath, Buffer.from(base64, 'base64'))
            if (!normalisePhoto(rawPath, join(mediaDir, item.filename))) stripped = false
          }

          writeFileSync(entryPath, buildYaml(parsed.data as Record<string, unknown>))

          return send(200, {
            id,
            entryPath: `data/entries/${id}.yaml`,
            mediaDir: `public/media/${id}/`,
            files: named.map((m) => m.filename),
            metadataStripped: stripped,
          })
        } catch (error) {
          return send(500, { error: (error as Error).message })
        }
      })
    },
  }
}
