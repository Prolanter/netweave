import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use relative asset paths in the production build so the bundle works when
// loaded from the local filesystem inside Electron (file://). The dev server
// keeps the default absolute base.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
}))
