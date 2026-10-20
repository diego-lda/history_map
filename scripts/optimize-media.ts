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

type Toolkit = 'sips' | 'magick' | 'im6'

function has(binary: string): boolean {
  try {
    execFileSync('which', [binary], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * macOS has sips. Linux has ImageMagick, in two incompatible shapes:
 * v7 exposes one `magick` binary with subcommands, v6 exposes separate
 * `identify` and `convert`. Treating v6's `convert` as if it took an
 * `identify` subcommand made every probe fail silently, so the CI step
 * reported success while resizing nothing.
 */
function detectToolkit(): Toolkit | null {
  if (has('sips')) return 'sips'
  if (has('magick')) return 'magick'
  if (has('identify') && has('convert')) return 'im6'
  return null
}

function dimensions(toolkit: Toolkit, path: string): [number, number] | null {
  try {
    if (toolkit === 'sips') {
      const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], {
        encoding: 'utf8',
      })
      const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1])
      const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1])
      return w && h ? [w, h] : null
    }

    // `magick identify …` on v7, the standalone `identify` on v6.
    const [bin, args] =
      toolkit === 'magick'
        ? ['magick', ['identify', '-format', '%w %h', path]]
        : ['identify', ['-format', '%w %h', path]]

    const out = execFileSync(bin as string, args as string[], { encoding: 'utf8' })
    const [w, h] = out.trim().split(/\s+/).map(Number)
    return w && h ? [w, h] : null
  } catch (error) {
    // Loudly: a silent probe failure is what hid this bug in CI.
    console.error(`  ! could not read dimensions of ${path}: ${(error as Error).message}`)
    return null
  }
}

function resize(toolkit: Toolkit, path: string): void {
  if (toolkit === 'sips') {
    execFileSync('sips', ['-Z', String(LONG_EDGE), path, '--out', path], { stdio: 'ignore' })
    return
  }
  // `>` means "only shrink", belt and braces alongside the caller's check.
  const bin = toolkit === 'magick' ? 'magick' : 'convert'
  execFileSync(bin, [path, '-resize', `${LONG_EDGE}x${LONG_EDGE}>`, '-strip', path], {
    stdio: 'ignore',
  })
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

const tool = detectToolkit()
if (!tool) {
  console.error('No image toolkit found (looked for sips, magick, identify+convert).')
  process.exit(1)
}
console.log(`Using ${tool}.`)

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
