import { useMemo } from 'react'
import type { Entry } from '../data/schema.ts'

type Props = { entries: Entry[] }

/**
 * A running count rather than a colour key — the type chips in the filter bar
 * already carry the colours, so repeating them here would be redundant.
 */
export default function Legend({ entries }: Props) {
  const stats = useMemo(() => {
    const countries = new Set(
      entries.map((entry) => entry.place?.country_code ?? entry.place?.country).filter(Boolean),
    )
    return { places: entries.length, countries: countries.size }
  }, [entries])

  if (stats.places === 0) return null

  return (
    <div className="legend">
      <strong>{stats.places}</strong> {stats.places === 1 ? 'place' : 'places'}
      {stats.countries > 0 && (
        <>
          {' · '}
          <strong>{stats.countries}</strong>{' '}
          {stats.countries === 1 ? 'country' : 'countries'}
        </>
      )}
    </div>
  )
}
