import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
const base = process.env.VITE_BASE || '/cet4-study-planner/'
export default defineConfig({
  base, plugins: [react(), VitePWA({
    registerType: 'prompt', injectRegister: null,
    includeAssets: ['icon.svg', 'icons/*.png', 'THIRD_PARTY_NOTICES.txt', 'legacy-exporter.txt'],
    manifest: {
      id: base, name: '拾光 · StudyFlow', short_name: '拾光', description: '给学习留一点温柔', lang: 'zh-CN',
      start_url: base, scope: base, display: 'standalone', orientation: 'portrait-primary',
      theme_color: '#F8F7F4', background_color: '#F8F7F4',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      navigateFallback: 'index.html', cleanupOutdatedCaches: true,
      navigateFallbackDenylist: [/\/private\//], clientsClaim: true
    }
  })]
})
