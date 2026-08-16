import { useEffect, useState } from 'react'

/**
 * Used only where the *interaction* differs between phone and desktop (sidebar
 * vs bottom sheet, and how far the map pans to clear it). Anything that's purely
 * visual is handled in CSS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
