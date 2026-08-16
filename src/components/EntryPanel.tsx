import { useEffect, useRef, useState } from 'react'
import type { Entry } from '../data/schema.ts'
import { fullDate } from '../data/schema.ts'
import { typeInfo } from '../data/locationTypes.ts'
import { useIsMobile } from '../hooks/useMediaQuery.ts'
import MediaGallery from './MediaGallery.tsx'

type Props = {
  entry: Entry | null
  onClose: () => void
}

function formatDate(value: string): string {
  const date = new Date(fullDate(value))
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    // A YYYY-MM entry means "sometime that month" — don't invent a day for it.
    ...(value.length > 7 ? { day: 'numeric' } : {}),
  })
}

/** country_code -> flag, by offsetting ASCII letters into regional indicators. */
function flag(countryCode: string): string {
  return String.fromCodePoint(
    ...[...countryCode].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0)),
  )
}

export default function EntryPanel({ entry, onClose }: Props) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<number | null>(null)

  // A newly selected entry always opens at peek height, scrolled to the top —
  // otherwise you inherit the last entry's scroll position.
  useEffect(() => {
    setExpanded(false)
    bodyRef.current?.scrollTo({ top: 0 })
  }, [entry?.id])

  if (!entry) return null

  const info = typeInfo(entry.type)
  const place = [entry.place?.city, entry.place?.country].filter(Boolean).join(', ')

  const onGrabberPointerDown = (event: React.PointerEvent) => {
    dragStart.current = event.clientY
  }

  const onGrabberPointerUp = (event: React.PointerEvent) => {
    if (dragStart.current === null) return
    const dy = event.clientY - dragStart.current
    dragStart.current = null

    if (dy < -40) setExpanded(true)
    else if (dy > 40) {
      if (expanded) setExpanded(false)
      else onClose()
    } else setExpanded((value) => !value) // a tap
  }

  return (
    <aside
      className="panel"
      data-expanded={isMobile && expanded ? 'true' : 'false'}
      aria-label={`Entry: ${entry.title}`}
    >
      <div
        className="panel__grabber"
        onPointerDown={onGrabberPointerDown}
        onPointerUp={onGrabberPointerUp}
        aria-hidden="true"
      />

      <button className="panel__close" type="button" onClick={onClose} aria-label="Close">
        ×
      </button>

      <div className="panel__body" ref={bodyRef}>
        <header className="panel__header">
          <span className="chip" style={{ '--chip-color': info.color } as React.CSSProperties}>
            <span aria-hidden="true">{info.glyph}</span> {info.label}
          </span>

          <h1 className="panel__title">{entry.title}</h1>

          <p className="panel__meta">
            {entry.place?.country_code && (
              <span aria-hidden="true">{flag(entry.place.country_code)} </span>
            )}
            {place && <span>{place}</span>}
            {place && ' · '}
            <time dateTime={entry.date}>{formatDate(entry.date)}</time>
          </p>

          {entry.rating && (
            <p className="panel__rating" aria-label={`Rated ${entry.rating} out of 5`}>
              <span aria-hidden="true">
                {'★'.repeat(entry.rating)}
                {/* Outline glyph, not a faint filled one — a pale ★ reads as a
                    rendering glitch rather than as an unfilled star. */}
                <span className="panel__rating-empty">{'☆'.repeat(5 - entry.rating)}</span>
              </span>
            </p>
          )}
        </header>

        {entry.media && entry.media.length > 0 && (
          <MediaGallery entryId={entry.id} media={entry.media} />
        )}

        <section className="panel__section">
          <p className="panel__prose">{entry.description}</p>
        </section>

        {entry.opinion && (
          <section className="panel__section panel__section--opinion">
            <h2 className="panel__heading">What I thought</h2>
            <p className="panel__prose">{entry.opinion}</p>
          </section>
        )}

        {entry.tags && entry.tags.length > 0 && (
          <ul className="tags">
            {entry.tags.map((tag) => (
              <li className="tag" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        )}

        {entry.links && entry.links.length > 0 && (
          <ul className="links">
            {entry.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer noopener">
                  {link.label} ↗
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="panel__id">{entry.id}</p>
      </div>
    </aside>
  )
}
