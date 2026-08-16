import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

import 'leaflet/dist/leaflet.css'
// Positioning and the zoom-in/out animations for clusters. Deliberately not
// MarkerCluster.Default.css — that ships the stock blue bubbles, and the
// cluster badge is styled in app.css instead.
import 'leaflet.markercluster/dist/MarkerCluster.css'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
