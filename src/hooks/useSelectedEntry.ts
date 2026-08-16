import { useCallback, useEffect, useState } from 'react'

const PARAM = 'entry'

function readParam(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM)
}

/**
 * Selection lives in the URL as ?entry=<id>, which buys three things for free:
 * every pin is a shareable link, the back button closes the panel, and a
 * reloaded page reopens where you left off.
 */
export function useSelectedEntry(): [string | null, (id: string | null) => void] {
  const [selectedId, setSelectedId] = useState<string | null>(readParam)

  // Back/forward buttons.
  useEffect(() => {
    const onPopState = () => setSelectedId(readParam())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const select = useCallback((id: string | null) => {
    setSelectedId(id)

    const url = new URL(window.location.href)
    if (id) url.searchParams.set(PARAM, id)
    else url.searchParams.delete(PARAM)

    // pushState so Back is "close the panel" rather than "leave the site".
    window.history.pushState({}, '', url)
  }, [])

  return [selectedId, select]
}
