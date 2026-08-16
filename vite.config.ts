import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<username>.github.io/history_map/, so assets live under
// that subpath. If you move to a custom domain later, change this to '/' — and
// nothing else, because every media URL is built from import.meta.env.BASE_URL
// via mediaUrl() in src/data/media.ts rather than being hardcoded.
export default defineConfig({
  base: '/history_map/',
  plugins: [react()],
})
