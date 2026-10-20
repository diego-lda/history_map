import { useEffect, useRef, useState } from 'react'
import { LOCATION_TYPE_KEYS, typeInfo, type LocationType } from '../data/locationTypes.ts'

const MAX_PHOTOS = 5

type Photo = { file: File; previewUrl: string; caption: string; alt: string }

type Result =
  | { kind: 'ok'; id: string; entryPath: string; files: string[]; metadataStripped: boolean }
  | { kind: 'error'; message: string; issues?: { path: string; message: string }[] }

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Accepts what you actually get from Google Maps, including the Spanish decimal
 * comma — "42,3423382, 2,8346148" is the form that has silently failed
 * validation more than once, so the form takes it and normalises it.
 */
export function parseCoordinates(raw: string): { lat: number; lon: number } | null {
  const cleaned = raw.trim().replace(/[()]/g, '')
  if (!cleaned) return null

  // Split on the separator between the pair, not on decimal commas: a comma
  // followed by a space, or a bare space.
  const parts = cleaned.includes(', ') ? cleaned.split(/,\s+/) : cleaned.split(/\s+|,/)
  if (parts.length !== 2) return null

  const toNumber = (part: string) => Number(part.trim().replace(',', '.'))
  const lat = toNumber(parts[0])
  const lon = toNumber(parts[1])

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  if (lat === 0 && lon === 0) return null

  return { lat, lon }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function AddEntryForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [coords, setCoords] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<LocationType>('other')
  const [description, setDescription] = useState('')
  const [opinion, setOpinion] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)

  // Object URLs leak unless revoked.
  useEffect(
    () => () => photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const effectiveId = idTouched ? id : slugify(title)
  const parsedCoords = parseCoordinates(coords)
  const coordsInvalid = coords.trim().length > 0 && !parsedCoords

  const canSubmit =
    Boolean(effectiveId) && Boolean(title.trim()) && Boolean(description.trim()) && Boolean(parsedCoords) && !submitting

  function addFiles(list: FileList | null) {
    if (!list) return
    const room = MAX_PHOTOS - photos.length
    const incoming = Array.from(list)
      .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .slice(0, room)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file), caption: '', alt: '' }))
    setPhotos((current) => [...current, ...incoming])
  }

  function updatePhoto(index: number, patch: Partial<Photo>) {
    setPhotos((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].previewUrl)
      return current.filter((_, i) => i !== index)
    })
  }

  function movePhoto(index: number, delta: number) {
    setPhotos((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !parsedCoords) return

    setSubmitting(true)
    setResult(null)

    try {
      const media = await Promise.all(
        photos.map(async (p) => ({
          name: p.file.name,
          caption: p.caption.trim() || undefined,
          alt: p.alt.trim() || undefined,
          dataUrl: await readAsDataUrl(p.file),
        })),
      )

      const tagList = tags
        .split(',')
        .map((t) => slugify(t))
        .filter(Boolean)

      const place: Record<string, string> = {}
      if (city.trim()) place.city = city.trim()
      if (country.trim()) place.country = country.trim()
      if (countryCode.trim()) place.country_code = countryCode.trim().toUpperCase()

      const response = await fetch('/__add-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: {
            id: effectiveId,
            title: title.trim(),
            coordinates: parsedCoords,
            date,
            type,
            description: description.trim(),
            ...(opinion.trim() ? { opinion: opinion.trim() } : {}),
            ...(Object.keys(place).length ? { place } : {}),
            ...(rating ? { rating } : {}),
            ...(tagList.length ? { tags: tagList } : {}),
          },
          media,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setResult({ kind: 'error', message: payload.error ?? 'Request failed', issues: payload.issues })
      } else {
        setResult({ kind: 'ok', ...payload })
      }
    } catch (error) {
      setResult({ kind: 'error', message: (error as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  if (result?.kind === 'ok') {
    return (
      <div className="form-overlay" onClick={onClose}>
        <div className="form form--done" onClick={(e) => e.stopPropagation()}>
          <h2 className="form__title">Entry created</h2>
          <p className="form__written">
            <code>{result.entryPath}</code>
            {result.files.length > 0 && (
              <>
                <br />
                <code>public/media/{result.id}/</code> — {result.files.join(', ')}
              </>
            )}
          </p>
          {!result.metadataStripped && (
            <p className="form__warn">
              Photos were copied as-is — <code>sips</code> wasn't available, so EXIF (including
              GPS) was not stripped and they were not resized.
            </p>
          )}
          <p className="form__note">
            Review the file, then commit and push. Nothing is published until you do.
          </p>
          <div className="form__actions">
            <button
              type="button"
              className="form__submit"
              onClick={() => {
                window.location.search = `?entry=${result.id}`
              }}
            >
              View it on the map
            </button>
            <button type="button" className="form__cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <form className="form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="form__header">
          <h2 className="form__title">New entry</h2>
          <button type="button" className="form__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="form__note">
          Writes <code>data/entries/&lt;id&gt;.yaml</code> and <code>public/media/&lt;id&gt;/</code>
          straight into the repo. Local only — review, then commit and push.
        </p>

        <label className="form__field">
          <span>Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pantà de Darnius-Boadella" required />
        </label>

        <label className="form__field">
          <span>
            Entry ID * <em>filename and media folder</em>
          </span>
          <input
            value={effectiveId}
            onChange={(e) => {
              setIdTouched(true)
              setId(slugify(e.target.value))
            }}
            placeholder="girona-darnius-boadella"
            required
          />
        </label>

        <label className="form__field">
          <span>
            Coordinates * <em>paste straight from Google Maps; decimal commas are fine</em>
          </span>
          <input
            value={coords}
            onChange={(e) => setCoords(e.target.value)}
            placeholder="42,3423382, 2,8346148"
            aria-invalid={coordsInvalid}
            required
          />
          {parsedCoords && (
            <small className="form__ok">
              lat {parsedCoords.lat}, lon {parsedCoords.lon}
            </small>
          )}
          {coordsInvalid && <small className="form__bad">Expected two numbers, e.g. 42.3423, 2.8346</small>}
        </label>

        <div className="form__row">
          <label className="form__field">
            <span>Date *</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>

          <label className="form__field">
            <span>Type *</span>
            <select value={type} onChange={(e) => setType(e.target.value as LocationType)}>
              {LOCATION_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {typeInfo(key).glyph} {typeInfo(key).label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form__field">
          <span>
            Description * <em>what the place is</em>
          </span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>

        <label className="form__field">
          <span>
            Opinion <em>what you thought — the point of the site</em>
          </span>
          <textarea rows={4} value={opinion} onChange={(e) => setOpinion(e.target.value)} />
        </label>

        <div className="form__row">
          <label className="form__field">
            <span>City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Darnius" />
          </label>
          <label className="form__field">
            <span>Country</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Spain" />
          </label>
          <label className="form__field form__field--narrow">
            <span>Code</span>
            <input
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="ES"
              maxLength={2}
            />
          </label>
        </div>

        <div className="form__row">
          <div className="form__field">
            <span>Rating</span>
            <div className="form__stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="form__star"
                  data-on={n <= rating}
                  onClick={() => setRating(n === rating ? 0 : n)}
                  aria-label={`${n} of 5`}
                >
                  {n <= rating ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>

          <label className="form__field">
            <span>
              Tags <em>comma separated</em>
            </span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="river, swimming" />
          </label>
        </div>

        <div className="form__field">
          <span>
            Photos <em>{photos.length} of {MAX_PHOTOS} — resized to 1600px and EXIF stripped</em>
          </span>

          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/mp4"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          {photos.length < MAX_PHOTOS && (
            <button type="button" className="form__pick" onClick={() => fileInput.current?.click()}>
              Choose photos…
            </button>
          )}

          <ul className="form__photos">
            {photos.map((photo, index) => (
              <li className="form__photo" key={photo.previewUrl}>
                <img src={photo.previewUrl} alt="" />
                <div className="form__photo-fields">
                  <input
                    value={photo.caption}
                    onChange={(e) => updatePhoto(index, { caption: e.target.value })}
                    placeholder="Caption"
                  />
                  <input
                    value={photo.alt}
                    onChange={(e) => updatePhoto(index, { alt: e.target.value })}
                    placeholder="Alt text (for screen readers)"
                  />
                </div>
                <div className="form__photo-tools">
                  <button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(index, 1)}
                    disabled={index === photos.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => removePhoto(index)} aria-label="Remove">
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {result?.kind === 'error' && (
          <div className="form__error">
            <strong>{result.message}</strong>
            {result.issues && (
              <ul>
                {result.issues.map((issue, i) => (
                  <li key={i}>
                    <code>{issue.path}</code> {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="form__actions">
          <button type="submit" className="form__submit" disabled={!canSubmit}>
            {submitting ? 'Writing files…' : 'Create entry'}
          </button>
          <button type="button" className="form__cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
