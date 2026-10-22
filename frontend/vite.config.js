import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base "./" : fonctionne en local (racine) ET sur GitHub Pages
// (https://<compte>.github.io/CareWatch/) sans configuration supplémentaire.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173
  }
})
