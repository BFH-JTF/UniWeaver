import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Keep the dependency cache outside the project folder. The repository lives in a
// cloud-synced directory (Nextcloud) which locks files on Windows and makes Vite's
// rename of node_modules/.vite/deps fail with EPERM.
const cacheDir = join(process.env.LOCALAPPDATA || tmpdir(), 'uniweaver-vite', 'administration')

export default defineConfig({
  base: '/administration/',
  cacheDir,
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../../dist/apps/administration',
    emptyOutDir: true,
  },
})
