import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Le depot est servi par GitHub Pages sous /miamee/, d'ou la base.
export default defineConfig({
  base: '/miamee/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-180.png', 'favicon.png'],
      manifest: {
        name: 'Miamee — journal alimentaire',
        short_name: 'Miamee',
        description: 'Mesurer et documenter ce que je mange',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/miamee/',
        scope: '/miamee/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#12201a',
        theme_color: '#12201a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/miamee/index.html',
      },
    }),
  ],
})
