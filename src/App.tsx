import { useEffect, useMemo, useState } from 'react'
import { loadEntries } from './data/loadEntries.ts'
import type { LocationType } from './data/locationTypes.ts'
import MapView from './components/MapView.tsx'
import EntryPanel from './components/EntryPanel.tsx'
import FilterBar from './components/FilterBar.tsx'
import Legend from './components/Legend.tsx'
import { useSelectedEntry } from './hooks/useSelectedEntry.ts'

export default function App() {
  const entries = useMemo(() => loadEntries(), [])
  const [selectedId, setSelectedId] = useSelectedEntry()
  const [activeTypes, setActiveTypes] = useState<Set<LocationType>>(new Set())
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (activeTypes.size > 0 && !activeTypes.has(entry.type)) return false
      if (!q) return true
      const haystack = [
        entry.title,
        entry.description,
        entry.opinion ?? '',
        entry.place?.city ?? '',
        entry.place?.country ?? '',
        ...(entry.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, activeTypes, query])

  const selected = entries.find((entry) => entry.id === selectedId) ?? null

  // A selected entry stays on the map even if the filters would hide it —
  // otherwise following a shared link with filters active shows nothing.
  const visible = useMemo(() => {
    if (selected && !filtered.some((e) => e.id === selected.id)) {
      return [...filtered, selected]
    }
    return filtered
  }, [filtered, selected])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setSelectedId])

  return (
    <div className="app" data-panel-open={selected ? 'true' : 'false'}>
      <MapView
        entries={visible}
        selected={selected}
        onSelect={setSelectedId}
        panelOpen={Boolean(selected)}
      />

      <FilterBar
        entries={entries}
        matchCount={filtered.length}
        activeTypes={activeTypes}
        onTypesChange={setActiveTypes}
        query={query}
        onQueryChange={setQuery}
      />

      <Legend entries={entries} />

      <EntryPanel entry={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
