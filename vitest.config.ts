import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

const root = path.dirname(fileURLToPath(import.meta.url))

// Coverage targets the logic-carrying modules ("Kernlogik"), not Vite
// entry files or Vue components.
const coverageInclude = [
  'backend/src/lib/**',
  'apps/*/src/utils/**',
  'packages/shared/src/api.ts',
  'packages/shared/src/toolAuth.ts',
  'packages/shared/src/restrictions.ts',
  'packages/shared/src/restrictionSolver.ts',
]

const coverage = { include: coverageInclude }

/**
 * Vitest 4 projects: one project per workspace so the apps' '@' alias
 * resolves locally. Backend integration tests (backend/test/*.ts) keep
 * their own tsx runners and need a real PostgreSQL; vitest covers the
 * pure-logic units instead.
 */
function appProject(app: string, environment: 'node' | 'jsdom' = 'node') {
  return {
    plugins: [vue(), vuetify({ autoImport: true })],
    resolve: {
      alias: { '@': path.join(root, 'apps', app, 'src') },
    },
    test: {
      name: app,
      include: [`apps/${app}/src/**/*.test.ts`],
      environment,
      coverage,
      setupFiles: environment === 'jsdom' ? [path.join(root, 'apps', app, 'src', 'test.setup.ts')] : [],
      // Vuetify ships .css imports for component registration; without
      // inlining, node's ESM loader chokes on them.
      server: { deps: { inline: ['vuetify'] } },
    },
  }
}

export default defineConfig({
  test: {
    coverage,
    projects: [
      { test: { name: 'backend', include: ['backend/src/**/*.test.ts'], environment: 'node', coverage } },
      { test: { name: 'shared', include: ['packages/shared/src/**/*.test.ts'], environment: 'node', coverage } },
      appProject('administration', 'jsdom'),
      appProject('scheduling'),
      appProject('user_entry'),
      appProject('competencies'),
    ],
  },
})
