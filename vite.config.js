import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/chilterboard/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,db,wasm}'],
        maximumFileSizeToCacheInBytes: 250 * 1024 * 1024,
      },
      manifest: {
        name: 'Kilter Board Browser',
        short_name: 'KilterPWA',
        start_url: '/chilterboard/',
        description: 'Offline Kilter Board Database',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'img/launchericon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'img/launchericon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});