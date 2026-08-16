import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Entry } from '../data/schema.ts'
import { typeInfo } from '../data/locationTypes.ts'
import { useIsMobile } from '../hooks/useMediaQuery.ts'

/** Kept in sync with --panel-width / --sheet-height in styles/app.css. */
const PANEL_WIDTH = 420
const SHEET_HEIGHT_RATIO = 0.45
const SELECTED_ZOOM = 13

type Props = {
  entries: Entry[]
  selected: Entry | null
  onSelect: (id: string | null) => void
  panelOpen: boolean
}

/**
 * Pins are divIcons rather than image markers: it keeps colour and glyph driven
 * by the type table, scales crisply, and sidesteps Leaflet's well-known broken
 * default-marker asset paths under a bundler.
 */
function pinIcon(entry: Entry, isSelected: boolean): L.DivIcon {
  const { color, glyph } = typeInfo(entry.type)
  return L.divIcon({
    className: 'pin-icon',
    html: `<div class="pin${isSelected ? ' pin--selected' : ''}" style="--pin-color:${color}"><span class="pin__glyph">${glyph}</span></div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  })
}

/**
 * Runs `action` only once the map container has a non-zero size.
 *
 * Leaflet derives fitBounds' zoom and flyTo's animation curve from the container
 * dimensions. On a 0x0 container fitBounds silently pins the view at maxZoom and
 * flyTo divides by zero, producing a NaN centre that throws on every animation
 * frame and leaves the map wedged mid-flight. The container legitimately starts
 * at 0x0 — before first layout, in a background tab, inside a hidden panel — so
 * this waits for a real measurement rather than guessing at a delay.
 */
function whenMeasured(map: L.Map, action: () => void): () => void {
  const container = map.getContainer()
  const isMeasured = () => container.clientWidth > 0 && container.clientHeight > 0

  // Leaflet caches the container size, and that cache can hold a stale 0x0 from
  // before layout — so re-measure before acting, on both paths.
  const run = () => {
    map.invalidateSize()
    action()
  }

  if (isMeasured()) {
    run()
    return () => {}
  }

  const observer = new ResizeObserver(() => {
    if (!isMeasured()) return
    observer.disconnect()
    run()
  })

  observer.observe(container)
  return () => observer.disconnect()
}

/**
 * Imperative map behaviour lives here — react-leaflet exposes the map instance
 * only to children of MapContainer.
 */
function MapController({ entries, selected, onSelect, panelOpen }: Props) {
  const map = useMap()
  const isMobile = useIsMobile()
  const hasFitInitialBounds = useRef(false)

  useMapEvents({
    click: () => onSelect(null),
  })

  // Fit every pin on first paint, so the initial view depends on where you've
  // actually been rather than on a hardcoded centre.
  useEffect(() => {
    if (hasFitInitialBounds.current || entries.length === 0) return
    if (selected) return // a deep link wins; the effect below handles it

    const bounds = L.latLngBounds(entries.map((e) => [e.coordinates.lat, e.coordinates.lon]))

    return whenMeasured(map, () => {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 })
      hasFitInitialBounds.current = true
    })
  }, [entries, map, selected])

  // Ease the selected pin into the part of the map that isn't covered by the
  // panel: right of centre on desktop, above centre on mobile.
  useEffect(() => {
    if (!selected) return

    return whenMeasured(map, () => {
      const zoom = Math.max(map.getZoom(), SELECTED_ZOOM)
      const point = map.project([selected.coordinates.lat, selected.coordinates.lon], zoom)

      if (panelOpen) {
        if (isMobile) point.y += (map.getSize().y * SHEET_HEIGHT_RATIO) / 2
        else point.x += PANEL_WIDTH / 2
      }

      map.flyTo(map.unproject(point, zoom), zoom, { duration: 0.8 })
    })
  }, [selected, map, isMobile, panelOpen])

  // Leaflet measures its container on creation; the panel animating in changes
  // the usable area on mobile, so tell it to re-measure.
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 350)
    return () => window.clearTimeout(timer)
  }, [panelOpen, map])

  return null
}

export default function MapView(props: Props) {
  const { entries, selected, onSelect } = props

  const markers = useMemo(
    () =>
      entries.map((entry) => (
        <Marker
          key={entry.id}
          position={[entry.coordinates.lat, entry.coordinates.lon]}
          icon={pinIcon(entry, entry.id === selected?.id)}
          zIndexOffset={entry.id === selected?.id ? 1000 : 0}
          alt={entry.title}
          eventHandlers={{
            click: (event) => {
              // Otherwise the map's own click handler immediately deselects.
              L.DomEvent.stopPropagation(event)
              onSelect(entry.id)
            },
          }}
        />
      )),
    [entries, selected, onSelect],
  )

  return (
    <MapContainer
      className="map"
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={19}
      worldCopyJump
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      {markers}
      <MapController {...props} />
    </MapContainer>
  )
}
