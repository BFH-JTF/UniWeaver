import { defineWorkspace } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

function appWorkspace(app: string) {
  return {
    test: {
      name: app,
      include: [`apps/${app}/src/**/*.test.ts`],
      environment: 'node' as const,
    },
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
  appWorkspace('administration'),
  appWorkspace('scheduling'),
  appWorkspace('user_entry'),
  appWorkspace('competencies'),
])