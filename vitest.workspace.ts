import { defineWorkspace } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// Unit tests are split per workspace so the apps' '@' alias resolves locally.
// Backend integration tests (backend/test/*.ts) keep their own tsx runner and
// need a real PostgreSQL; vitest covers the pure-logic units instead.
// Coverage targets the logic-carrying modules ("Kernlogik"), not Vite
// entry files or Vue components.
const root = path.dirname(fileURLToPath(import.meta.url))

const coverageInclude = [
  'backend/src/lib/**',
  'apps/*/src/utils/**',
  'packages/shared/src/api.ts',
  'packages/shared/src/toolAuth.ts',
  'packages/shared/src/restrictions.ts',
  'packages/shared/src/restrictionSolver.ts',
]

function appWorkspace(app: string, environment: 'node' | 'jsdom' = 'node') {
  return {
    plugins: [vue(), vuetify({ autoImport: true })],
    test: {
      name: app,
      include: [`apps/${app}/src/**/*.test.ts`],
      environment,
      setupFiles: environment === 'jsdom' ? [path.join(root, 'apps', app, 'src', 'test.setup.ts')] : [],
      // Vuetify ships .css imports for component registration; without
      // inlining, node's ESM loader chokes on them.
      server: { deps: { inline: ['vuetify'] } },
    } as never,
    resolve: {
      alias: { '@': path.join(root, 'apps', app, 'src') },
    },
  }
}

export default defineWorkspace([
  {
    test: {
      name: 'backend',
      include: ['backend/src/**/*.test.ts'],
      environment: 'node' as const,
    },
  },
  {
    test: {
      name: 'shared',
      include: ['packages/shared/src/**/*.test.ts'],
      environment: 'node' as const,
    },
  },
  appWorkspace('administration', 'jsdom'),
  appWorkspace('scheduling'),
  appWorkspace('user_entry'),
  appWorkspace('competencies'),
])