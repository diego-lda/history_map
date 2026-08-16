/**
 * The controlled vocabulary for `type`, and its presentation.
 *
 * Adding a type means adding one line here — the schema, the validator, the pin
 * colours and the legend all read from this table. Unknown types are rejected at
 * validation time on purpose, so the legend stays meaningful instead of slowly
 * accumulating one-off values.
 */
export const LOCATION_TYPES = {
  food: { label: 'Food', color: '#E4572E', glyph: '🍽' },
  drink: { label: 'Drink', color: '#B5179E', glyph: '☕' },
  lodging: { label: 'Lodging', color: '#7209B7', glyph: '🛏' },
  viewpoint: { label: 'Viewpoint', color: '#E8A33D', glyph: '🌅' },
  nature: { label: 'Nature', color: '#2A9D8F', glyph: '🌲' },
  hike: { label: 'Hike', color: '#4C956C', glyph: '🥾' },
  beach: { label: 'Beach', color: '#00B4D8', glyph: '🏖' },
  museum: { label: 'Museum', color: '#6A4C93', glyph: '🏛' },
  landmark: { label: 'Landmark', color: '#E63946', glyph: '🗿' },
  village: { label: 'Village', color: '#F77F00', glyph: '🏘' },
  shop: { label: 'Shop', color: '#A4243B', glyph: '🛍' },
  event: { label: 'Event', color: '#3A86FF', glyph: '🎪' },
  other: { label: 'Other', color: '#6C757D', glyph: '📍' },
} as const

export type LocationType = keyof typeof LOCATION_TYPES

/** Tuple form, for z.enum() and for iterating in a stable order. */
export const LOCATION_TYPE_KEYS = Object.keys(LOCATION_TYPES) as [
  LocationType,
  ...LocationType[],
]

export const typeInfo = (type: LocationType) => LOCATION_TYPES[type]
