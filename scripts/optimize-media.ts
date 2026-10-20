/**
 * Caps every committed photo at 1600px on the long edge.
 *
 * The dev-only "Add entry" form already does this on the way in, but Decap
 * commits uploads to GitHub untouched — there is no hook to transform them. So
 * the cap is enforced here instead, and run in CI after a push, which is the
 * only point both authoring paths pass through.
 *
 * Deliberately a no-op for images already within the cap. Re-encoding every
 * image on every run would rewrite bytes each time, and since macOS `sips` and
 * Linux ImageMagick do not produce identical output, local and CI would commit
 * over each other forever.
 *
 * Run: npm run media:optimize        (rewrites oversized images in place)
 *      npm run media:optimize -- --check   (reports, changes nothing, exits 1)
 */
import { readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, extname } from 'node:path'

const LONG_EDGE = 1600
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mediaDir = join(root, 'public', 'media')
const checkOnly = process.argv.includes('--check')

/** macOS has sips; Linux CI runners have ImageMagick. Use whichever exists. */
function detectTool(): 'sips' | 'magick' | 'convert' | null {
  for (const tool of ['sips', 'magick', 'convert'] as const) {
    try {
      execFileSync('which', [tool], { stdio: 'ignore' })
      return tool
    } catch {
      /* keep looking */
    }
  }
  return null
}

function dimensions(tool: string, path: string): [number, number] | null {
  try {
    if (tool === 'sips') {
      const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], {
        encoding: 'utf8',
      })
      const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1])
      const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1])
      return w && h ? [w, h] : null
    }
    const out = execFileSync(tool, ['identify', '-format', '%w %h', path], { encoding: 'utf8' })
    const [w, h] = out.trim().split(/\s+/).map(Number)
    return w && h ? [w, h] : null
  } catch {
    return null
  }
}

function resize(tool: string, path: string): void {
  if (tool === 'sips') {
    execFileSync('sips', ['-Z', String(LONG_EDGE), path, '--out', path], { stdio: 'ignore' })
  } else {
    // `>` means "only shrink", belt and braces alongside the check below.
    execFileSync(tool, [path, '-resize', `${LONG_EDGE}x${LONG_EDGE}>`, '-strip', path], {
      stdio: 'ignore',
    })
  }
}

function* walk(dir: string): Generator<string> {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (name.startsWith('.')) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (EXTENSIONS.has(extname(name).toLowerCase())) yield path
  }
}

const tool = detectTool()
if (!tool) {
  console.error('No image tool found (looked for sips, magick, convert).')
  process.exit(1)
}

const oversized: string[] = []

for (const path of walk(mediaDir)) {
  const size = dimensions(tool, path)
  if (!size) continue

  const longEdge = Math.max(...size)
  if (longEdge <= LONG_EDGE) continue

  const relative = path.slice(root.length + 1)
  oversized.push(relative)

  if (checkOnly) {
    console.log(`  over cap  ${relative} (${size[0]}x${size[1]})`)
  } else {
    resize(tool, path)
    const after = dimensions(tool, path)
    console.log(`  resized   ${relative} ${size[0]}x${size[1]} -> ${after?.[0]}x${after?.[1]}`)
  }
}

if (oversized.length === 0) {
  console.log(`All photos within ${LONG_EDGE}px.`)
  process.exit(0)
}

if (checkOnly) {
  console.error(`\n${oversized.length} photo(s) over ${LONG_EDGE}px. Run: npm run media:optimize`)
  process.exit(1)
}

console.log(`\nResized ${oversized.length} photo(s).`)
