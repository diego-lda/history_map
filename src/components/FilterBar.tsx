import { useMemo, useState } from 'react'
import type { Entry } from '../data/schema.ts'
import { LOCATION_TYPE_KEYS, typeInfo, type LocationType } from '../data/locationTypes.ts'
import { useIsMobile } from '../hooks/useMediaQuery.ts'

type Props = {
  entries: Entry[]
  matchCount: number
  activeTypes: Set<LocationType>
  onTypesChange: (types: Set<LocationType>) => void
  query: string
  onQueryChange: (query: string) => void
}

export default function FilterBar({
  entries,
  matchCount,
  activeTypes,
  onTypesChange,
  query,
  onQueryChange,
}: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  // Only offer types that actually exist in the data — a legend full of types
  // you've never used is noise.
  const usedTypes = useMemo(() => {
    const counts = new Map<LocationType, number>()
    for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1)
    return LOCATION_TYPE_KEYS.filter((type) => counts.has(type)).map((type) => ({
      type,
      count: counts.get(type)!,
    }))
  }, [entries])

  const toggleType = (type: LocationType) => {
    const next = new Set(activeTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    onTypesChange(next)
  }

  const isFiltered = activeTypes.size > 0 || query.length > 0
  const expanded = !isMobile || open

  return (
    <div className="filters" data-open={expanded ? 'true' : 'false'}>
      <div className="filters__top">
        <input
          className="filters__search"
          type="search"
          value={query}
          placeholder={`Search ${entries.length} places…`}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="Search entries"
        />
        {isMobile && (
          <button
            className="filters__toggle"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {activeTypes.size > 0 ? `Filters (${activeTypes.size})` : 'Filters'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="filters__types">
          {usedTypes.map(({ type, count }) => {
            const info = typeInfo(type)
            const active = activeTypes.has(type)
            return (
              <button
                key={type}
                type="button"
                className="chip chip--button"
                data-active={active ? 'true' : 'false'}
                style={{ '--chip-color': info.color } as React.CSSProperties}
                onClick={() => toggleType(type)}
                aria-pressed={active}
              >
                <span aria-hidden="true">{info.glyph}</span> {info.label}
                <span className="chip__count">{count}</span>
              </button>
            )
          })}

          {isFiltered && (
            <button
              className="filters__clear"
              type="button"
              onClick={() => {
                onTypesChange(new Set())
                onQueryChange('')
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {isFiltered && (
        <p className="filters__count" role="status">
          {matchCount} of {entries.length}
        </p>
      )}
    </div>
  )
}
